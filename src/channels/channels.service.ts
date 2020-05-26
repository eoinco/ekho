import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { getManager, getRepository, IsNull, Repository } from 'typeorm';
import { ChainManager } from '../chain-manager/chain-manager.interface';
import { Contact } from '../contacts/contacts.entity';
import { ContactsService } from '../contacts/contacts.service';
import { CryptographyService } from '../cryptography/cryptography.service';
import EkhoEventDto from '../events/dto/ekhoevent.dto';
import { EkhoEvent } from '../events/entities/events.entity';
import { EventsService } from '../events/events.service';
import { FileManager } from '../file-manager/file-manager.interface';
import { KeyManager } from '../key-manager/key-manager.interface';
import { User } from '../users/entities/users.entity';
import { UsersService } from '../users/users.service';
import BroadcastChannelDto from './dto/broadcastchannel.dto';
import CreateBroadcastChannelDto from './dto/create-broadcastchannel.dto';
import CreateChannelDto from './dto/create-channel.dto';
import CreateExternalChannelDto from './dto/create-externalchannel.dto';
import EncodedMessageDto from './dto/encodedmessage.dto';
import BroadcastChannelLinkDto from './dto/link-broadcastchannel.dto';
import ProcessReport from './dto/processreport.dto';
import RawMessageDto from './dto/rawmessage.dto';
import { BroadcastChannel } from './entities/broadcastchannels.entity';
import { ChannelMember } from './entities/channelmembers.entity';
import { ChannelMessage } from './entities/channelmessages.entity';
import { Channel } from './entities/channels.entity';

@Injectable()
export class ChannelsService {
  private readonly BASE_64 = 'base64';
  private readonly UTF_8 = 'utf-8';
  private readonly HEX = 'hex';
  private readonly CHAIN_KEY_ID = 1;
  private readonly CHAIN_KEY_CONTEXT = 'ChainKey';
  private readonly MESSAGE_KEY_RATCHET = 1;
  private readonly CHAIN_KEY_RATCHET = 2;
  private readonly INITIAL_NONCE = 1;

  constructor(
    @InjectRepository(Channel)
    private readonly channelRepository: Repository<Channel>,
    @InjectRepository(ChannelMember)
    private readonly channelMemberRepository: Repository<ChannelMember>,
    @InjectRepository(ChannelMessage)
    private readonly channelMessageRepository: Repository<ChannelMessage>,
    @InjectRepository(BroadcastChannel)
    private readonly broadcastChannelRepository: Repository<BroadcastChannel>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @Inject('KeyManager')
    private readonly keyManager: KeyManager,
    private readonly userService: UsersService,
    private readonly contactService: ContactsService,
    private readonly cryptoService: CryptographyService,
    @Inject('FileManager')
    private readonly fileManager: FileManager,
    @Inject('ChainManager')
    private readonly chainManager: ChainManager,
    private readonly eventService: EventsService,
  ) {}

  // *** Functional Methods ***

  // Process all pending blockchain events in DB
  async process(userId: string): Promise<ProcessReport> {
    try {
      Logger.debug(`Channel.Process: Starting Processing for userid: ${userId}`);
      const processReport = new ProcessReport();
      processReport.receivedMessages = 0;
      processReport.processedTotal = 0;
      processReport.receivedMessageEvents = [];

      const channelMembersByUser = await this.findChannelMembersByUser(userId);

      for (const channelMember of channelMembersByUser) {
        let nextChannelIdentifier = channelMember.nextChannelIdentifier;
        Logger.debug(
          `Channel.Process: Processing channel member: ${channelMember.id} with expected Channel Identifier ${nextChannelIdentifier}`,
        );

        let allMessagesRead: boolean = false;

        while (!allMessagesRead) {
          // check if we have an event for that channel member
          const newEvent: EkhoEvent = await this.eventService.getTransactionByChannelId(nextChannelIdentifier);

          // if we have an event, process it
          if (newEvent) {
            Logger.debug(`Channel.Process: event found for channelIdentifier ${nextChannelIdentifier}`);

            const incomingMessage = new EncodedMessageDto();
            incomingMessage.channelIdentifier = newEvent.channelId;
            incomingMessage.encryptedMessageLink = newEvent.content;
            incomingMessage.encryptedMessageLinkSignature = newEvent.signature;

            try {
              const message: RawMessageDto = await this.validateAndDecryptEvent(newEvent, incomingMessage);
              if (message) {
                Logger.debug(
                  `Channel.Process: Decoded message from ${channelMember.id} with Channel Identifier ${nextChannelIdentifier}`,
                );
                processReport.receivedMessages++;
                processReport.receivedMessageEvents.push(incomingMessage);
                nextChannelIdentifier = await (await this.findChannelMemberById(channelMember.id))
                  .nextChannelIdentifier;
                Logger.debug(
                  `Channel.Process: next expected Channel Identifier from ${channelMember.id} is ${nextChannelIdentifier}`,
                );
              }
            } catch (e) {
              Logger.debug(
                `Channel.Process: event ${newEvent.id.toString()} could not be decoded (possible collision).`,
              );
            } finally {
              processReport.processedTotal++;
              Logger.debug(
                `Channel.Process: ${processReport.receivedMessages} messages processed from ${channelMember.id}`,
              );
            }
          } else {
            allMessagesRead = true;
            Logger.debug(
              `Channel.Process: Done. ${processReport.receivedMessages} messages received from ${channelMember.id}.`,
            );
            Logger.debug('Channel.Process.End.');
          }
        }
      }
      return processReport;
    } catch (err) {
      Logger.debug(`Channel.Process.Error: ${err.message}`);
      throw err;
    }
  }

  // Create a channel message
  async createChannelMessage(channelMessage: RawMessageDto): Promise<EncodedMessageDto> {
    Logger.debug(`Channel.createChannelMessage: Sending message for user ${channelMessage.userId}`);

    // get the user - fail if they don't exist
    const messageSender = await this.userService.findById(channelMessage.userId, true);

    // get the channel member
    const channelMember = await this.findChannelMemberByUserAndChannel(channelMessage.userId, channelMessage.channelId);

    // get next expected message nonce
    const nonce = await this.getExpectedMessageNonceByChannelMemberId(channelMember.id);

    // the message is coming from the user, so it's an outgoing message
    const newChannelMessage = await this.createMessage(channelMember, channelMessage.messageContents, nonce);

    // Get the Channel Identifier for the message
    const senderPublicKey = await this.keyManager.readPublicSigningKey(messageSender.id);

    const channelIdentifier = await this.createChannelIdentifier(
      senderPublicKey,
      channelMember.channel.channelKey,
      nonce,
    );

    // Get the message key and add it to the channelmessage details
    const messageKey = await this.getMessageKey(channelMember.messageChainKey);
    newChannelMessage.messageKey = messageKey;

    // encrypt the message
    const newEncryptedMessage = this.cryptoService.encrypt(
      newChannelMessage.messageContents,
      nonce,
      messageKey,
      this.UTF_8,
      this.BASE_64,
    );

    // send the message to IPFS
    const messageLink = await this.sendToFileManager(newEncryptedMessage);

    // encrypt the message link with the message key
    const encryptedMessageLink = this.cryptoService.encrypt(messageLink, nonce, messageKey, this.UTF_8, this.BASE_64);

    // hash the encrypted message link with message nonce (to prevent replay attacks)
    const EMLwithNonce = this.cryptoService.hash(encryptedMessageLink + nonce.toString());

    // sign the encrypted IPFS hash + message nonce with the user signing key
    const Signature = await this.keyManager.sign(messageSender.id, EMLwithNonce);

    // encrypt the signature with the message key
    const encryptedSignature = this.cryptoService.encrypt(Signature, nonce, messageKey, this.BASE_64, this.BASE_64);

    // save the event
    const eventId = await this.sendToChain(channelIdentifier, encryptedMessageLink, encryptedSignature);

    // sacrifice a chicken in the hope that this has been successful
    if (eventId) {
      // Update the member message chain key
      channelMember.messageChainKey = await this.ratchetChainKey(channelMember.messageChainKey);

      // Update the member next channel identifier
      channelMember.nextChannelIdentifier = await this.createChannelIdentifier(
        senderPublicKey,
        channelMember.channel.channelKey,
        nonce + 1,
      );

      Logger.debug(`Channel.createChannelMessage: getting event info for id: ${eventId}`);
      newChannelMessage.ekhoEvent = await this.eventService.getOneById(eventId);

      // save the channel member & message details
      Logger.debug(`Channel.createChannelMessage: saving channel message and member`);
      await getManager().transaction(async transactionalEntityManager => {
        await transactionalEntityManager.save(newChannelMessage);
        await transactionalEntityManager.save(channelMember);
      });

      Logger.debug(`Channel.createChannelMessage: Channel message created for ${channelMessage.userId}`);
      // return the encoded message
      const encodedMessage = new EncodedMessageDto();
      encodedMessage.channelIdentifier = channelIdentifier;
      encodedMessage.encryptedMessageLink = encryptedMessageLink;
      encodedMessage.encryptedMessageLinkSignature = encryptedSignature;
      return encodedMessage;
    }
  }

  async getBroadcastChannelLink(userId: string, channelId: string): Promise<BroadcastChannelLinkDto> {
    await this.userService.findById(userId);

    const broadcastChannel = await this.broadcastChannelRepository.findOneOrFail({
      relations: ['channel'],
      where: { user: { id: userId }, channel: { id: channelId } },
    });

    const channelLink = new BroadcastChannelLinkDto();
    channelLink.name = broadcastChannel.channel.name;
    channelLink.broadcastKey = broadcastChannel.broadcastKey;

    channelLink.signingKey = await this.keyManager.readPublicSigningKey(userId);
    const dataToSign = this.cryptoService.hash(channelLink.name + channelLink.broadcastKey + channelLink.signingKey);
    channelLink.signature = await this.keyManager.sign(userId, dataToSign);

    const verified = this.keyManager.verifySignature(channelLink.signature, dataToSign, channelLink.signingKey);

    if (!verified) {
      throw new Error('signature not validating correctly');
    }

    return channelLink;
  }

  // adds a broadcast channel from a non-contact source
  async followBroadcast(userId: string, channelLink: BroadcastChannelLinkDto): Promise<Channel> {
    Logger.debug(`Channel.followBroadcast: creating broadcast channel listener for ${userId}`);
    // 1. get user (fail if not found)
    await this.userService.findById(userId);

    // validate signature
    const signedData = this.cryptoService.hash(channelLink.name + channelLink.broadcastKey + channelLink.signingKey);
    const signed = this.keyManager.verifySignature(channelLink.signature, signedData, channelLink.signingKey);

    if (signed) {
      // check if contact exists for this signingkey (in which case use them, otherwise create one)
      const contact = await this.contactService.findOneContactBySigningKey(
        userId,
        channelLink.name,
        channelLink.signingKey,
      );

      // create channel
      const newChannel = await this.createChannel(channelLink.name, channelLink.broadcastKey);

      const userChannelMember = await this.createChannelMember(null, contact, newChannel, channelLink.broadcastKey);

      // save everything (in a transaction)

      await getManager().transaction(async transactionalEntityManager => {
        await transactionalEntityManager.save(newChannel);
        await transactionalEntityManager.save(userChannelMember);
      });

      Logger.debug(`Channel.followBroadcast: broadcast channel listener created for ${userId}`);
      // 8. return the saved channel
      return await this.findChannelById(newChannel.id);
    }
  }

  // Create a channel and members
  async createBroadcastChannel(channel: CreateBroadcastChannelDto): Promise<BroadcastChannelDto> {
    Logger.debug(`Channel.createBroadcastChannel: creating broadcast channel for ${channel.userId}`);

    // get user
    const channelUser = await this.userService.findById(channel.userId);

    // create shared secret
    const sharedSecret = await this.cryptoService.generateRandomBytes().toString(this.BASE_64);

    // create channel
    const newChannel = await this.createChannel(channel.name, sharedSecret);

    // create channelmember for user
    const userChannelMember = await this.createChannelMember(channelUser, null, newChannel, sharedSecret);

    // create Broadcast Channel for user
    const broadcastChannel = await this.linkBroadcastChannel(channel.name, sharedSecret, channelUser, newChannel);

    // 7. save everything (in a transaction)
    await getManager().transaction(async transactionalEntityManager => {
      await transactionalEntityManager.save(newChannel);
      await transactionalEntityManager.save(userChannelMember);
      await transactionalEntityManager.save(broadcastChannel);
    });

    // get the broadcast channel + sharing link details
    const newBroadcastChannel = new BroadcastChannelDto();
    newBroadcastChannel.channelId = newChannel.id;
    newBroadcastChannel.userId = channel.userId;
    newBroadcastChannel.broadcastLink = await this.getBroadcastChannelLink(channelUser.id, newChannel.id);

    Logger.debug(`Channel.createBroadcastChannel: broadcast channel created for ${channel.userId}`);

    return newBroadcastChannel;
  }

  // Get a specified user's broadcast channels
  async getBroadcastChannels(userId: string): Promise<BroadcastChannel[]> {
    return await this.broadcastChannelRepository.find({
      relations: ['channel', 'user'],
      where: { user: userId },
    });
  }

  // Create a contact and channel based on an external contact
  // (where the handshake is performed outside of ekho)
  async createExternalChannelAndMembers(channel: CreateExternalChannelDto): Promise<Channel> {
    Logger.debug(`Channel.createExternalChannelAndMembers: creating external channel for ${channel.userId}`);

    // 1. get user
    const channelUser = await this.userService.findById(channel.userId);

    // 2. find / create contact
    const channelContact = await this.contactService.findOrCreateExternalContact(
      channel.userId,
      channel.contactName,
      channel.contactPublicKey,
      channel.contactIdentifier,
    );

    const sharedSecret = channel.channelSharedSecret;

    // 4. create channel
    const newChannel = await this.createChannel(channel.channelName, sharedSecret);

    // 5. create channelmember for user
    const userChannelMember = await this.createChannelMember(channelUser, null, newChannel, sharedSecret);

    // 6. create channelmember for contact
    const contactChannelMember = await this.createChannelMember(null, channelContact, newChannel, sharedSecret);

    // 7. save everything (in a transaction)
    await getManager().transaction(async transactionalEntityManager => {
      await transactionalEntityManager.save(newChannel);
      await transactionalEntityManager.save(userChannelMember);
      await transactionalEntityManager.save(contactChannelMember);
    });

    Logger.debug(`Channel.createExternalChannelAndMembers: channel created for ${channel.userId}`);

    // 8. return the saved channel
    return await this.findChannelById(newChannel.id);
  }

  // Create a channel and members
  async createChannelAndMembers(channel: CreateChannelDto): Promise<Channel> {
    Logger.debug(`Channel.createChannelAndMembers: creating channel for ${channel.userId}`);

    // 1. get user
    const channelUser = await this.userService.findById(channel.userId);

    // 2. get contact (must be owned by user)
    const channelContact = await this.contactService.findOneContact(channel.userId, channel.contactId);

    // 3. create shared secret
    const sharedSecret = await this.createSharedSecret(channelContact);

    // 4. create channel
    const newChannel = await this.createChannel(channel.name, sharedSecret);

    // 5. create channelmember for user
    const userChannelMember = await this.createChannelMember(channelUser, null, newChannel, sharedSecret);

    // 6. create channelmember for contact
    const contactChannelMember = await this.createChannelMember(null, channelContact, newChannel, sharedSecret);

    // 7. save everything (in a transaction)
    await getManager().transaction(async transactionalEntityManager => {
      await transactionalEntityManager.save(newChannel);
      await transactionalEntityManager.save(userChannelMember);
      await transactionalEntityManager.save(contactChannelMember);
    });

    Logger.debug(`Channel.createChannelAndMembers: channel created for ${channel.userId}`);

    // 8. return the saved channel
    return await this.findChannelById(newChannel.id);
  }

  // *** (CHANNEL MESSAGE) Find Methods **
  /*
  // Finds a channelmessage  by id (TODO: for user id)
  async findChannelMessageByUserId(id: number): Promise<ChannelMessage[]> {
    const allMessages = await this.channelMessageRepository.find({
      relations: ['channelMember', 'channelMember.user'],
      order: { nonce: 'ASC' },
    });
    // as the where clause above isn't working, doing in process filtering for now
    // but for some odd reason, id passes as string... converting to int to use in filter
    // suspecting a bug in nestjs
    return allMessages.filter(m => m.channelMember.user?.id === `${id}`, 10);
  }
  */
  /*
  // Finds a channelmessage  by id
  async findChannelMessageByContactId(userId: string, contactId: string): Promise<ChannelMessage[]> {
    const allMessages = await this.channelMessageRepository.find({
      relations: ['channelMember', 'channelMember.contact'],
      where: { 'channelMember.contact.user': userId, 'channelMember.contact': contactId },
      order: { nonce: 'ASC' },
    });
    // see above findChannelMessageByUserId
    const messages = await allMessages.filter(m => m.channelMember.contact?.id === contactId);
    return messages;
  }
*/
  // Finds a channelmessage  by id
  async findChannelMessages(userId: string, contactId: string, channelId: string): Promise<ChannelMessage[]> {
    const allMessages = await this.channelMessageRepository.find({
      relations: ['channelMember', 'channelMember.contact', 'channelMember.channel'],
      where: { 'channelMember.contact.user': userId },
      order: { nonce: 'ASC' },
    });
    let filteredMessages = allMessages;

    if (contactId) {
      filteredMessages = await filteredMessages.filter(m => m.channelMember.contact?.id === contactId);
    }

    if (channelId) {
      filteredMessages = await filteredMessages.filter(m => m.channelMember.channel.id === channelId);
    }

    return filteredMessages;
  }

  /*
  // Finds all channel messages (TODO: for user id)
  async findAllChannelMessages(): Promise<ChannelMessage[]> {
    return await this.channelMessageRepository.find({ relations: ['channelMember'] });
  }
*/
  // *** (CHANNEL MEMBER) Find methods ***

  // Finds channel member by id (TODO: for user id)
  async findChannelMemberById(channelMemberId: string): Promise<ChannelMember> {
    return await this.channelMemberRepository.findOneOrFail({
      relations: ['channel', 'contact', 'user'],
      where: { id: channelMemberId },
    });
  }

  // Finds all records based on search criteria (TODO: for user id)
  async findAllChannelMembers(): Promise<ChannelMember[]> {
    return await this.channelMemberRepository.find({
      relations: ['channel', 'contact', 'user'],
    });
  }

  // Finds channel member by userid and channelid
  async findChannelMemberByUserAndChannel(userId: string, channelId: string): Promise<ChannelMember> {
    return await this.channelMemberRepository.findOneOrFail({
      relations: ['channel', 'contact', 'user'],
      where: { channel: channelId, user: userId },
    });
  }

  // Finds channel member by userid and channelid
  async findChannelMembersByUser(userId: string): Promise<ChannelMember[]> {
    const channelMembers = await getRepository(ChannelMember)
      .createQueryBuilder('channelmember')
      .innerJoin('channelmember.contact', 'contact', 'contact.user = :userId', { userId })
      .getMany();

    return channelMembers;
  }

  // *** Channel FIND Methods ***

  // Finds a channel by its channel id (TODO: for user id)
  async findChannelById(id: string): Promise<Channel> {
    return await this.channelRepository.findOneOrFail({
      relations: ['channelmembers'],
      where: { id },
    });
  }

  // Finds all channels (TODO: for user id)
  async findAllChannels(): Promise<Channel[]> {
    return await this.channelRepository.find({ relations: ['channelmembers'] });
  }

  // *** Private methods ***

  // Validate and decrypt a blockchain event
  private async validateAndDecryptEvent(
    messageEvent: EkhoEvent,
    channelMessage: EncodedMessageDto,
  ): Promise<RawMessageDto> {
    Logger.debug(`Channel.ValidateAndDecryptEvent: validating and decrypting event ${messageEvent.channelId}`);

    // break up the message into its parts
    const channelIdentifier = channelMessage.channelIdentifier;
    const encryptedMessageLink = channelMessage.encryptedMessageLink;
    const signature = channelMessage.encryptedMessageLinkSignature;

    // find the channel member
    const potentialChannelMembers = await this.findChannelMemberbyNextChannelIdentifier(channelIdentifier);

    for (const channelMember of potentialChannelMembers) {
      Logger.debug(`Channel.ValidateAndDecryptEvent: found potential message from channel member ${channelMember.id}`);

      // get the message key
      const messageKey = await this.getMessageKey(channelMember.messageChainKey);

      // get next expected message nonce
      const nonce = await this.getExpectedMessageNonceByChannelMemberId(channelMember.id);

      // first decrypt the signature with the expected message key
      const decryptedSignature = this.cryptoService.decrypt(signature, nonce, messageKey, this.BASE_64, this.BASE_64);

      // then the validate signature needs the nonce and message key before it can validate signature
      const EMLwithNonce = this.cryptoService.hash(encryptedMessageLink + nonce.toString());

      // check the signature
      const signed = await this.keyManager.verifySignature(
        decryptedSignature,
        EMLwithNonce,
        channelMember.contact.signingKey,
      );

      if (!signed) {
        throw new BadRequestException(`Channel.ValidateAndDecryptEvent: message not correctly signed`);
      } else {
        Logger.debug(`Channel.ValidateAndDecryptEvent: signature valid for ${messageEvent.channelId}`);

        // get the raw message
        const rawMessage = await this.getRawMessage(encryptedMessageLink, nonce, messageKey);

        // the message is an incoming message, so set up the Channel Message object
        const newChannelMessage = await this.createMessage(channelMember, rawMessage, nonce);

        // associate the message with the event and store the decryption key (for repudiation)
        newChannelMessage.ekhoEvent = messageEvent;
        newChannelMessage.messageKey = messageKey;

        // update the channel member
        const updatedChannelMember = await this.updateChannelMemberDetails(channelMember, nonce);

        Logger.debug(`Channel.ValidateAndDecryptEvent: saving message ${messageEvent.id} to database`);
        // update the db
        await getManager().transaction(async transactionalEntityManager => {
          await transactionalEntityManager.save(newChannelMessage);
          await transactionalEntityManager.save(updatedChannelMember);
        });
        Logger.debug(`Channel.ValidateAndDecryptEvent: saved message ${messageEvent.id} to database`);
        // output the raw message
        const rawMessageContents = new RawMessageDto();
        rawMessageContents.messageContents = newChannelMessage.messageContents;
        Logger.debug(`Channel.ValidateAndDecryptEvent: returning raw message. Finished Decrypting and Validating.`);
        return rawMessageContents;
      }
    }
  }

  // creates a message chain key
  private async createMessageChainKey(sharedSecret: string): Promise<string> {
    Logger.debug('Channel.createMessageChainKey: creating message chain key');

    const chainKeyId = this.CHAIN_KEY_ID;
    const chainKeyContext = this.CHAIN_KEY_CONTEXT;
    const messageChainKey = this.cryptoService.deriveSymmetricKeyfromSecret(sharedSecret, chainKeyId, chainKeyContext);

    Logger.debug('Channel.createMessageChainKey: created message chain key');
    return messageChainKey;
  }

  // creates a channel key
  private async createChannelKey(sharedSecret: string): Promise<string> {
    Logger.debug('Channel.createChannelKey: creating channel key');

    const channelKey = this.cryptoService.hash(sharedSecret + sharedSecret);

    Logger.debug('Channel.createChannelKey: created channel key');
    return channelKey;
  }

  // creates a shared secret
  private async createSharedSecret(channelContact: Contact): Promise<string> {
    Logger.debug('Channel.createSharedSecret: creating shared secret');

    const sharedSecret = this.cryptoService.generateECDHSharedSecret(
      channelContact.oneuseKey,
      channelContact.handshakePrivateKey,
    );

    Logger.debug('Channel.createSharedSecret: created shared secret');
    return sharedSecret;
  }

  // creates a channel identifier
  private async createChannelIdentifier(signingKey: string, channelKey: string, nonce: number): Promise<string> {
    Logger.debug('Channel.createChannelIdentifier: creating channel identifier');

    const channelIdentifier = this.cryptoService.shortHash(signingKey + channelKey + nonce, channelKey);

    Logger.debug(`Channel.createChannelIdentifier: created channel identifier`);
    return channelIdentifier;
  }

  // creates a channel member
  private async createChannelMember(
    user: User,
    contact: Contact,
    channel: Channel,
    secret: string,
  ): Promise<ChannelMember> {
    Logger.debug(`Channel.createChannelMember: creating channel member`);

    const newChannelMember = new ChannelMember();
    newChannelMember.messageChainKey = await this.createMessageChainKey(secret);
    newChannelMember.channel = channel;

    if (user) {
      Logger.debug(`Channel.createChannelMember: for user id ${user.id}`);

      const userPublicKey = await this.keyManager.readPublicSigningKey(user.id);

      newChannelMember.nextChannelIdentifier = await this.createChannelIdentifier(
        userPublicKey,
        channel.channelKey,
        this.INITIAL_NONCE,
      );
      newChannelMember.user = user;
      newChannelMember.contact = null;
    }

    if (contact) {
      Logger.debug(`Channel.createChannelMember: for contact id ${contact.id}`);

      newChannelMember.nextChannelIdentifier = await this.createChannelIdentifier(
        contact.signingKey,
        channel.channelKey,
        this.INITIAL_NONCE,
      );
      newChannelMember.user = null;
      newChannelMember.contact = contact;
    }

    Logger.debug(`Channel.createChannelMember: created channel member for channel ${newChannelMember.channel.name}`);
    return newChannelMember;
  }

  // creates link between user and channel for broadcasts
  private async linkBroadcastChannel(
    name: string,
    secret: string,
    user: User,
    channel: Channel,
  ): Promise<BroadcastChannel> {
    Logger.debug(`Channel.linkBroadcastChannel: creating broadcast channel link for ${user.id}`);

    const newBroadCast = new BroadcastChannel();
    newBroadCast.broadcastKey = secret;
    newBroadCast.channel = channel;
    newBroadCast.user = user;

    Logger.debug(`Channel.linkBroadcastChannel: created broadcast channel link for ${user.id}`);
    return newBroadCast;
  }

  // creates a channel
  private async createChannel(name: string, secret: string): Promise<Channel> {
    Logger.debug(`Channel.createChannel: creating channel ${name}`);

    const newChannel = new Channel();
    newChannel.name = name;
    newChannel.channelKey = await this.createChannelKey(secret);

    Logger.debug(`Channel.createChannel: created channel ${name}`);
    return newChannel;
  }

  // Gets the current expected nonce for a channel member
  private async getExpectedMessageNonceByChannelMemberId(channelMemberId: string): Promise<number> {
    Logger.debug(
      `Channel.getExpectedMessageNonceByChannelMemberId: getting expected nonce for channel member ${channelMemberId}`,
    );

    const latestChannelMessage = await getRepository(ChannelMessage)
      .createQueryBuilder('ChannelMessage')
      .select('MAX(ChannelMessage.nonce)', 'maxnonce')
      .where('"ChannelMessage"."channelMemberId" = :channelMemberId', { channelMemberId })
      .groupBy('"ChannelMessage"."channelMemberId"')
      .getRawOne();

    if (latestChannelMessage) {
      Logger.debug(`Channel.getExpectedMessageNonceByChannelMemberId: messages found, returning nonce`);
      return latestChannelMessage.maxnonce + 1;
    } else {
      Logger.debug(`Channel.getExpectedMessageNonceByChannelMemberId: no messages found, getting default nonce`);
      // we have no messages, no next message will be nonce 1
      return 1;
    }
  }

  // finds a contact channel member (if any) for a provided channel identifier
  private async findChannelMemberbyNextChannelIdentifier(identifier: string): Promise<ChannelMember[]> {
    Logger.debug(
      `Channel.findChannelMemberbyNextChannelIdentifier: searching for channel member with nextCID ${identifier}`,
    );

    const channelMembers = await this.channelMemberRepository.find({
      relations: ['user', 'contact', 'channel'],
      where: { contactId: !IsNull(), userId: IsNull(), nextChannelIdentifier: identifier },
    });

    Logger.debug(`Channel.findChannelMemberbyNextChannelIdentifier: found ${channelMembers.length} members`);
    return channelMembers;
  }

  // ratchets the message chain key to get the message key
  private async getMessageKey(messageChainKey: string): Promise<string> {
    Logger.debug('Channel.getMessageKey: getting message key from chain key');

    const messageKey = this.cryptoService.hash(messageChainKey + this.MESSAGE_KEY_RATCHET);

    Logger.debug('Channel.getMessageKey: got message key from chain key');
    return messageKey;
  }

  // returns the raw data (string for moment) from an encrypted IPFS link
  private async getRawMessage(encryptedLink: string, nonce: number, key: string): Promise<string> {
    Logger.debug('Channel.getRawMessage: getting file address from encrypted link');

    const rawMessageLink = this.cryptoService.decrypt(encryptedLink, nonce, key, this.BASE_64, this.UTF_8);
    const rawMessageEncrypted = await this.fileManager.retrieve(rawMessageLink);
    const rawMessage = this.cryptoService.decrypt(rawMessageEncrypted, nonce, key, this.BASE_64, this.UTF_8);

    Logger.debug('Channel.getRawMessage: got file address from encrypted link');
    return rawMessage;
  }

  // ratchets the chain key for forward secrecy
  private async ratchetChainKey(chainKey: string): Promise<string> {
    Logger.debug('Channel.ratchetChainKey: ratcheting chain key');

    const ratchetedChainKey = this.cryptoService.hash(chainKey + this.CHAIN_KEY_RATCHET);

    Logger.debug('Channel.ratchetChainKey: ratcheted chain key');
    return ratchetedChainKey;
  }

  // updates the channel member's next channel identifier
  private async updateChannelMemberDetails(member: ChannelMember, nonce: number): Promise<ChannelMember> {
    Logger.debug(`Channel.updateChannelMemberDetails: updating channel member ${member.id} chain key`);

    member.messageChainKey = await this.ratchetChainKey(member.messageChainKey);
    member.nextChannelIdentifier = await this.createChannelIdentifier(
      member.contact.signingKey,
      member.channel.channelKey,
      nonce + 1,
    );
    Logger.debug(`Channel.updateChannelMemberDetails: updated channel member ${member.id} chain key`);
    return member;
  }

  // create a channel message entity
  private async createMessage(member: ChannelMember, message: string, nonce: number): Promise<ChannelMessage> {
    Logger.debug('Channel.CreateMessage: creating channel message');

    const channelMessage = new ChannelMessage();
    channelMessage.channelMember = member;
    channelMessage.messageContents = message;
    channelMessage.nonce = nonce;

    Logger.debug('Channel.CreateMessage: created channel message');
    return channelMessage;
  }

  // *** External Delivery methods ***

  // sends encrypted data to the File Manager
  private async sendToFileManager(message): Promise<string> {
    try {
      Logger.debug('Channel.sendToFileManager: sharing via File Manager');

      // Send the encrypted message to File Manager to get back the identifier
      const messageLink = await this.fileManager.store(message);

      Logger.debug('Channel.sendToFileManager: shared via File Manager');
      return messageLink;
    } catch (e) {
      throw e;
    }
  }

  // sends ekho event to chain
  private async sendToChain(channelId: string, link: string, signature: string): Promise<string> {
    try {
      Logger.debug(`Channel.sendToChain: emitting ${channelId} event to chain manager`);

      const ekho: EkhoEventDto = new EkhoEventDto();
      ekho.channelIdentifier = channelId;
      ekho.encryptedMessageLink = link;
      ekho.encryptedMessageLinkSignature = signature;
      const eventid = await this.chainManager.emitEkho(ekho);

      Logger.debug(`Channel.sendToChain: emitted ${channelId} event to chain manager`);
      return eventid;
    } catch (e) {
      Logger.debug(`Channel.sendToChain: error writing to chain manager: ${e}`);
      throw e;
    }
  }

  /* #region Excessive search methods */
  /**
   * Finds all channel member records for a given contact id
   * @param id contact id
   */
  async findAllChannelMembersByContactId(id: string): Promise<ChannelMember[]> {
    return this.channelMemberRepository.find({
      where: { contactId: id },
    });
  }

  /**
   * Find all channel member records for a given user id
   * @param id user id
   */
  async findAllChannelMembersByUserId(id: string): Promise<ChannelMember[]> {
    return this.channelMemberRepository.find({
      relations: ['channel'],
      where: { user: { id } },
    });
  }

  /**
   * Find all channel members for a given channel id
   * @param id channel id
   * @returns ChannelMember[] array of channel members in the channel
   */
  async findAllChannelMembersByChannelId(id: string): Promise<ChannelMember[]> {
    return this.channelMemberRepository.find({
      where: { channelId: id },
    });
  }

  /**
   * Returns all channel messages by channel id
   * @param id Channel id
   * @returns ChannelMessage[] list of channel messages (includes all child relationships)
   */
  async findAllChannelMessagesByChannelId(id: number): Promise<ChannelMessage[]> {
    const channelMessages = this.channelMessageRepository.find({
      relations: ['channelMember', 'channelMember.channel', 'channelMember.user', 'channelMember.contact'],
      where: { 'channelMember.channel.channelid': id },
    });
    return channelMessages;
  }
  /* #endregion */
}
