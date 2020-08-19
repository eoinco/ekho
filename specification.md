# ekho

a decentralised messaging layer for ethereum

## Objective

Creation of a peer-to-peer communication protocol, capable of transmitting messages containing anchors to data of arbitrary size and type (text, PDF, docx, JPG, MPEG etc). Messages are digitally signed and attributable to senders with integrity and authenticity assured via digital signature. The platform does not have a reliance on a third party to perform routing of messages and access to the platform will be open to all participants running the platform software. The Ethereum blockchain will act as the message bus between participants and the protocol provides the mechanism to both notify participants of the existence of a message from a particular sender and provide the underlying data which is readable only by the intended recipient, be it an individual, a sender-designated group of individuals, or the general public. Additionally, a batching capability is present to enable the protocol to scale beyond the one message per transaction limitation when using a blockchain as a message bus.

## Purpose

For individuals, **ekho** can be used as an intermittent messaging application if required. Its ability to broadcast publicly accessible messages also makes it useful in a decentralised web context, for example updating IPFS-hosted website data published by the sender without requiring the IPNS.

Its intended purpose, however, is to provide organisations with the ability to generate a digital heartbeat containing private and secure data attested by the organisation via cryptographic signature. An organisation would send an **ekho** on a regular cadence, for example once per block, every ten minutes, or every day. This **ekho** then anchors potentially terabytes of data, all digitally signed by the organisation and time stamped by its mined block. As an **ekho** can contain multiple **ekho** messages, an organisation can privately and securely provide attestable data to multiple recipients in a continuous, private and secure manner. In this manner, **ekho** ensures that attested data is time stamped and tamper-proof, and examples of data securely broadcast in an **ekho** message could be certification/identity information, KYC data, regulatory data (medical or financial), IOT device data, etc.

## Core Concepts

There are a number of core concepts in the **ekho** approach.

The address originating the **ekho** message is not used to validate the message. This validation is performed on the contents of the message. This enables one-time addresses to be used per message, or proxies to be used to deliver messages to mainnet on your behalf. Multiple proxies can be used to deliver the same message if required, increasing resilience and business continuity needs.

The message posted on chain does not contain the contents of the message, but is instead a pointer to the message stored in another location (IPFS, Azure, AWS, custom file transmission solution). This allows messages of arbitrary sizes without requiring excessive data storage on chain. Note that this pointer should be a content address, rather than a physical address (e.g. an IPFS hash retains the integrity of the signed data, while a URL does not).

The message data written on chain will be digitally signed by its creator to ensure authenticity and integrity. To prevent metadata leakage (comparison of signatures to known public signing keys), this signature will be encrypted.

The message data written on chain will be written to the logs, not to the smart contract state data (currently gas cost is 26,750 gas per on-chain **ekho**).

The smart contract enabling the log messages to be written will not and can not restrict access to particular participants. It is intended to be an open, censorship resistant layer.

Each message written has an identifier that allows only the recipients to identify the message creator and the channel used for the communication (whether private 1-1 comms, group comms or public comms).

## End to End Flow

Below is described the end-to-end flow of Alice creating a message and sending it via the blockchain for Bob, its recipient, to receive the notification of the message’s existence, validate that it comes from Alice and decrypt its contents.

### User Setup (Alice)

Alice will be used in the descriptions below as the application user, who will create and send messages, which will be received by her contact, Bob.

On application instantiation, the following keys are created as part of Alice’s user setup.

- Signing Key Pair (Ed25519 curve)
  - Signing Private Key - _PrivKeyAlice_
  - Signing Public Key - _PubKeyAlice_

The Signing Key Pair should be stored in a location where it cannot be exfiltrated, such as an HSM or a solution such as Hashicorp Vault (which permits signing operations on stored Ed25519 keys).

Alice’s identity within the **ekho** platform is based on this Signing Key Pair. This Signing Public Key could additionally be confirmed from more sources than the initial contact linking (displayed on twitter, website, legal documentation, signed by organisation x509 cert, signed by ENS SECP256k1 key etc. depending on your identity confirmation needs)

### Contact Setup (Bob)

Alice wants to communicate with Bob. In order to do this, Alice must add Bob as a contact in her local **ekho** system (there is no centralised address book). This involves Alice and Bob doing a Elliptic Curve Diffie Hellman handshake to exchange one-time keys signed by the Signing Key in order to generate a shared secret.

### Initial User/Contact Handshake

Alice obtains the following information from Bob (off-platform) and adds it to the Contact data:

- Signing Public Key - _PubKeyBob_
- One Use Public Key - _OneTimePubKeyBob_
- One Use Public Key Signature - _Signature(PrivKeyBob, OneTimePubKeyBob)_

Bob obtains the following information from Alice and adds it to his Contact data:

- Signing Public Key - _PubKeyAlice_
- One Use Public Key - _OneTimePubKeyAlice_
- One Use Public Key Signature - _Signature(PrivKeyAlice, OneTimePubKeyAlice)_

### Generating a Shared Secret

Once Alice and Bob have access to the linked one-time keys, they can perform a Diffie-Hellman operation on the keys to obtain a shared secret, known only to Alice and Bob (because they both own the corresponding private keys).

Alice specifically uses Elliptic Curve Diffie Hellman to generate a shared secret (SAB) to use in communications with Bob. Bob will do the same.

The shared secret (SAB) is calculated by Alice as:

_SAB = ECDH(OneTimePrivKeyAlice, OneTimePubKeyBob)_

And Bob calculates the shared secret (S) similarly:

_SAB = ECDH(OneTimePrivKeyBob, OneTimePrivKeyAlice)_

Both parties can then use the shared secret to initiate communications. The shared secret is used by each to create a local channel and ensure shared encryption keys for each message to that channel.

Messages sent are encrypted with forward secrecy using the Signal Protocol where underlying secrets are hash ratcheted to generate a different (deterministic, but non predictable) encryption key for each message.

### Initial Channel Setup

Once Alice and Bob have completed their handshake and obtained the shared key, they must set up the Channel Key and Message Chain Key.

The Channel Key is used to create the Channel Identifier, which is used by message recipients to determine if a message is from one of their contacts to a channel in which they are a member.

The Message Chain Key is used as part of the forward secrecy mechanism to ensure that each message is encrypted with a different, deterministic, but not predictable encryption key.

#### Channel Key

The first element of a channel is the Channel Key (CKAB). This is generated using the shared secret known to both Alice and Bob (SAB).

_CKAB = Hash(SAB, SAB)_

#### Message Chain Key

Alice then uses the shared secret (SAB) to deterministically (using HKDF) create the Message Chain Key for her Channel communications. The Message Chain Key is part of the Signal Protocol-based ratcheting mechanism to provide forward secrecy and is initially the same for Alice and Bob.

_MCKAB = HKDF(SAB)_

At this stage, the shared secret (SAB) and each parties One-Use Private Key (OneTimePrivKeyAlice & OneTimePrivKeyBob) can be discarded as they are no longer required.

### Creating an **ekho** message

To create an **ekho** message, Alice chooses the channel to which she wants to deliver the message. This channel can contain one or more contacts (to be covered in more detail in the Group Channels section). Alice then uses the Channel Key, Message Chain Key, Nonce (and her Signing Key) to create a message which can only be deciphered by members of that channel. This process is described below.

#### Creating a Message

Starting Conditions:

- Alice has her current Message Chain Key (MCKAB)
- Alice has the Channel Key (CKAB)
- Alice has her individual message nonce (NA)

The message nonce (NA) has an initial value of 1.

Note that Bob also has all of these as they are derived from the same shared secret. The Message Chain Key is initially identical for both Alice and Bob, but this is ratcheted for each message with the previous Message Chain Key discarded.

Alice calculates her message’s Channel Identifier (CIA) by hashing her public signing key with the channel key and her message nonce)

_CIA = Hash(PubKeyAlice, CKAB, NA)_

Alice creates a Message Key (MKA) from her Message Chain Key.

_MKA = H(MCKA, 1)_

Alice then updates the Message Chain Key and discards the old value.

_MCKA = H(MCKA, 2)_

Alice encrypts message contents (MSG) with Message Key (MKA) and writes the encrypted message contents to a document sharing repository. This returns the Message Link (ML) - ideally a content-addressable digest of the message contents, such as an IPFS address, which can be deterministically derived from the message contents to ensure message integrity. Providing a URL as the Message Link will work, but the contents of the message at the URL can change arbitrarily which would mean the message itself could change arbitrarily.

Alice encrypts the Message Link (MLA) with the Message Key (MKA) to create the Encrypted Message Link (EMLA).

_EMLA = { ML } MKA_

Alice then creates her Message Signature (MSA) by signing a hash of the Encrypted Message Link + Message Nonce with her Signing Key. Including the Message Nonce in the signature is required to prevent replay attacks.

_MSA = Sign(Hash(EMLA, NA))_

Alice then encrypts the Message Signature with the Message Key to create the Encrypted Message Signature (EMSA).

_EMSA = { MSA } MKA_

## Broadcasting an **ekho** on-chain

Alice now has all the information required to broadcast an **ekho** to the Ethereum blockchain. The smart contract is shown below:

```
pragma solidity >=0.4.22 <0.6.0;
contract ekho {
    event ekho(bytes message);
    function broadcast(bytes memory message) public {
        emit ekho(message);
    }
}
```

Alice executes the notify method and passes in the following values:

- Channel Identifier (8 bytes) - _CIA_
- Encrypted Message Link (46 bytes) - _EMLA_
- Encrypted Message Signature (64 bytes) - _EMLSA_

\*Note that for maximum flexibility in the Message Link, we'll look later at adding a fixed number of prepended bytes to the message link, but for the moment, it's good to assume that if they start with IPFS bytes (e.g. Qm or bafy) then it's an IPFS address :)

## Receiving a Message

Each time a message is written to the logs, an event is triggered by the smart contract containing the **ekho** details (channel identifier, encrypted message link and encrypted signature). The recipient needs to listen, or have access to these log events. This can be done, for example, via a web socket connection to Infura or monitoring a local node synchronised with mainnet.

Each contact in the recipient’s database exists in a context. This context is either that they are members of a channel, either a 1-1 channel, or a group channel with many members, or they are listening to public broadcast channel of that contact. Each member of a channel has an expected next Channel Identifier (short hash of Sender Public Identity Key + Channel Key + Nonce). If the event received contains an expected next Channel Identifier for a contact, e.g. Bob sees an **ekho** event with the Channel identifier he expects for Alice’s next **ekho**, he processes the message as below.

Starting Conditions:

- Bob has current Inbound Message Chain Key for Alice (_MCKA_)
- Bob has Signing Public Key of Alice (_PubKeyAlice_)
- Bob has Channel Key (_CKAB_)
- Bob has current message Nonce for Alice (based on messages received) (NA)

From the Channel Key (CKAB), Signing Public Key (PubKeyAlice), next message Nonce (NA+1), Bob can generate Alice’s next expected Channel Identifier to tell if this is a message from Alice on their Channel. Assuming this message has the expected Channel Identifier for Alice’s next **ekho**, Bob performs the following actions:

Bob calculates Alice’s current Message Key as _Hash(MCKA, 1)_.

Bob can use this Message Key (MKA) to decrypt the Encrypted Message Signature (EMSA).

Bob checks if this is a valid signature of the encrypted message link for this message nonce. If it is invalid, he discards the message.

If it is valid, he proceeds to decrypt the message details.

Bob decrypts the Encrypted Message Link using the Message Key (MKA).

Bob retrieves the Message (MSG) using the Message Link (i.e. pulls the file from IPFS if it's an IPFS address).

Note that currently we are using IPFS to distribute the encrypted messages, but other options are possible, such as Bob pulling the message from Alice’s internet-available endpoint (shared in the handshake), providing the decrypted Message Link and a signature of the Message Link, signed with his Signing Key.

Bob decrypts the Message using the Message Key (MKA).

Bob stores the decrypted Message for reading/processing. For later attribution/attestation Bob must retain the Message Key that was used to encrypt the **ekho** event and the message (MKA). This is required as proof of when the **ekho** event was sent (the timestamp of the block it is present in) and and for any later required validation of the **ekho** signature as being that of the Alice.

Bob then ratchets Alice’s Message Chain Key (_Hash(MCKA, 2)_) and overwrites the value, discarding the old value.

## Additional Functionality

While the above describes the fundamental operating mechanisms of the **ekho** protocol, there are a number of capabilities that can be created on top of this, such as group channels, batching of **ekho** messages into a single transaction and broadcast messages that can be globally available. We will cover these below as each building block component gets solidified.

### Broadcast Channels

Broadcast channels are one-way channels that can be used to deliver a message to any recipient that holds both the broadcast key for the channel and the public signing key of the sender. The distribution of the broadcast key is at the discretion of the user writing messages to the broadcast channel, but it is useful for each user to have at least one broadcast channel that they can share with their contacts when doing the initial contact handshake. It’s also likely that, when we define the message structure around the arbitrary data payload, that a list of one or more broadcast channels can be included in each message, enabling a user to administer their broadcast channels on a per-contact basis.

Fundamentally broadcast channels are an important component in the group channel functionality as a group channel is, at its core, a select group of users that share a key to enable group communications. This will be covered in more detail in the Group Channels section.

#### Creation of a Broadcast Channel

Creation of a broadcast channel follows the same process as the above 1-1 channel setup, with the only exception being that a Diffie-Hellman key exchange is not used to create the initial secret. Instead the shared secret - the Broadcast Key (BK) is created as a random 32-byte key, using a source of reasonable entropy.

- Broadcast Key - _Random 32-byte key_
- Channel Key - _CKA = Hash(BK, BK)_
- Message Chain Key - _MCKA = HKDF(BK)_

From this point, any messages Alice writes to this broadcast channel can be decrypted, validated and retrieved by any party in possession of the Broadcast Key, associated with Alice’s Public Signing Key (which is used to create the Channel Identifier as with any channel message).

Broadcast channels form the basis of group channels and batched messages, where a message itself contains a number of additional messages intended for N recipients in possession of the broadcast or channel key. Batched, broadcast messages enable a decentralised approach to sending messages to your recipients via multiple, batched broadcasters. This enables use cases where broadcasters batch messages and broadcast on chain at a fixed cadence, such as once per minute, hour etc.. This in turn enables additional metadata security, where a fixed amount of messages are always sent from the **ekho** client, but where a number of those messages are randomly generated data and not intended for any recipient.
