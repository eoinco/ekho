import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Transaction as Tx } from 'ethereumjs-tx';
import { bufferToHex } from 'ethereumjs-util';
import Web3 from 'web3';
import EkhoEventDto from '../../events/dto/ekhoevent.dto';
import { EkhoEvent } from '../../events/entities/events.entity';
import { EventsService } from '../../events/events.service';
import { ChainManager } from '../chain-manager.interface';
import { Web3Constants } from './web3/web3.constants';

@Injectable()
export class InfuraChainManager implements ChainManager {
  private readonly chain;
  private readonly hardfork;
  private readonly rpcUrl;
  private readonly contractAddress;
  private readonly address;
  private readonly privateKey;
  private readonly publicKey;
  private readonly gasPrice;
  private readonly BASE_64 = 'base64';
  private readonly HEX_ENCODING = 'hex';
  private readonly BYTES = 'bytes';
  private readonly CHANNEL_ID_BYTES = 8;
  private readonly SIGNATURE_BYTES = 64;

  constructor(
    private readonly configService: ConfigService,
    private readonly web3: Web3,
    private readonly eventService: EventsService,
  ) {
    this.chain = this.configService.get<string>('chainmanager.infura.chain');
    this.hardfork = this.configService.get<string>('chainmanager.infura.hardfork');
    this.rpcUrl = this.configService.get<string>('chainmanager.infura.rpcUrl');
    this.contractAddress = this.configService.get<string>('chainmanager.infura.contractAddress');
    this.address = this.configService.get<string>('chainmanager.infura.broadcastAccount.address');
    this.publicKey = this.configService.get<string>('chainmanager.infura.broadcastAccount.publicKey');
    this.privateKey = this.configService.get<string>('chainmanager.infura.broadcastAccount.privateKey');
    this.gasPrice = this.configService.get<string>('chainmanager.infura.broadcastAccount.gasPrice');
  }

  async onModuleInit(): Promise<void> {
    await this.listen();
  }

  async listen(): Promise<void> {
    Logger.debug('Web3.Refresh: polling blockchain for new log events.');
    let transactionsFound: number = 0;

    const options = {
      fromBlock: 0,
      address: this.contractAddress,
    };

    this.web3.eth
      .subscribe('logs', options, (error, result) => {
        if (error) {
          Logger.error(result);
        }
      })
      .on('data', async log => {
        Logger.debug('Web3.Refresh: ekho event found');
        const blockNumber = log.blockNumber;
        const transactionHash = log.transactionHash;

        const decoded = this.web3.eth.abi.decodeParameters([this.BYTES], log.data);
        const ekho = Buffer.from(decoded[0].slice(2), this.HEX_ENCODING);
        const event = await this.eventService.createEventFromEkho(ekho);
        Logger.debug(`Web3.Refresh: ekho event channel identifier ${event.channelIdentifier}`);
        let tx = await this.eventService.getByTransactionHash(transactionHash);
        if (!tx) {
          tx = new EkhoEvent();
          tx.channelId = event.channelIdentifier;
          tx.content = event.encryptedMessageLink;
          tx.signature = event.encryptedMessageLinkSignature;
          tx.txHash = transactionHash;
          tx.status = 'mined'; // TODO: change to ENUM
          tx.batchParent = '000-000-000-000';
          tx.block = blockNumber;
          await this.eventService.save(tx);
          Logger.debug(`Web3.Refresh: ekho event saved to db`);
          transactionsFound++;
        }
      })
      .on('changed', log => {
        Logger.debug(`Web3.Refresh: ${log}`);
      });
    Logger.debug(
      `Web3.Refresh: retrieved ${transactionsFound} new transactions from contract ${this.contractAddress} via ${this.rpcUrl}`,
    );
  }

  async emitEkho(event: EkhoEventDto): Promise<string> {
    Logger.debug(`Web3.emitEkho: getting nonce for ${event.channelIdentifier}`);
    const txCount = await this.getTransactionCount(this.address);
    Logger.debug(`Web3.emitEkho: nonce for ${event.channelIdentifier} is ${txCount}`);

    const bufferedPrivateKey = Buffer.from(this.privateKey, this.HEX_ENCODING);

    const contract = new this.web3.eth.Contract(Web3Constants.abi as any, this.contractAddress);

    let ekho: Buffer;

    ekho = await this.eventService.createEkhoFromEvent(event);

    const data = contract.methods.broadcast(ekho).encodeABI();

    const txObject = {
      nonce: this.web3.utils.toHex(txCount),
      gasLimit: this.web3.utils.toHex(800000),
      gasPrice: this.web3.utils.toHex(this.web3.utils.toWei(this.gasPrice, 'gwei')),
      to: this.contractAddress,
      data,
    };

    const tx = new Tx(txObject, { chain: this.chain, hardfork: this.hardfork });
    if (!(tx.validate() && bufferToHex(tx.getSenderAddress()) === this.address)) {
      // TODO: need to dig why this fails while transaction gets executed and mined successfully
      // throw Error('Invalid transaction');
    }
    tx.sign(bufferedPrivateKey);

    const serializedTx = tx.serialize();
    const raw = '0x' + serializedTx.toString(this.HEX_ENCODING);
    let txHash: any;
    try {
      Logger.debug('Web3.emitEkho: broadcasting transaction to chain');

      // squishing any unhandled promise exceptions...
      // so many try catches to cope with web3...
      try {
        txHash = await this.web3.eth.sendSignedTransaction(raw).catch(err => {
          Logger.debug('shhhh');
        });
      } catch (e) {
        Logger.debug('no, really, shhhh');
      }

      if (txHash) {
        Logger.debug(`Web3.emitEkho: transaction broadcast to chain. tx: ${txHash.transactionHash}`);
        const broadcastEvent = this.eventService.getByTransactionHash(txHash.transactionHash);
        return (await broadcastEvent).id;
      } else {
        throw new Error(`Web3.emitEkho: error writing to chain`);
      }
    } catch (e) {
      Logger.debug(`Web3.emitEkho: transaction failed. ${e.message}`);
      throw e;
    }
  }

  async getTransactionCount(account: string): Promise<number> {
    try {
      const txCount = await this.web3.eth.getTransactionCount(account);
      return txCount;
    } catch (e) {
      return e;
    }
  }
}
