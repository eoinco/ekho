import { AxiosResponse } from 'axios';
import { Ident } from 'provide-js';
import { CryptographyService } from '../../cryptography/cryptography.service';
import { KeyManager } from '../key-manager.interface';

export class ProvideKeyManager implements KeyManager {
  constructor(private readonly client: Ident, private readonly cryptographyService: CryptographyService) {}

  async createSigningKey(id: string): Promise<void> {
    // this.client.createVaultKey(vaultId, {
    //   // TODO: complete this stub...
    // });

    const payload = {
      type: 'ed25519',
      derived: false,
    };
    const response: AxiosResponse = await this.client.post(`/v1/users-signing-keys/keys/${id}`, payload);
    this.checkResponse(response, `Failed to create private signing keys for user ${id}`, 204);
  }

  async readPublicSigningKey(id: string): Promise<string> {
    // this.client.fetchVaultKeys(vaultId, {
    //   // TODO: complete this stub...
    // });

    const response: AxiosResponse = await this.client.get(`/v1/users-signing-keys/keys/${id}`);
    this.checkResponse(response, `Failed to create private signing keys for user ${id}`);
    return response.data.data.keys['1'].public_key;
  }

  async sign(id: string, data: string): Promise<string> {
    // TODO: complete this stub...
    // this.client.signMessage(vaultId, keyId, Buffer.from(data).toString('base64'));

    const payload = {
      input: Buffer.from(data).toString('base64'),
    };
    const response: AxiosResponse = await this.client.post(`/v1/users-signing-keys/sign/${id}`, payload);
    this.checkResponse(response, `Failed to create private signing keys for user ${id}`);
    const fullSignature: string = response.data.data.signature;
    const signature = fullSignature.split(':')[2];
    return signature;
  }

  async verifySignatureById(id: string, signature: string, data: string): Promise<boolean> {
    // TODO: complete this stub...
    // this.client.verifySignature(vaultId, id, Buffer.from(data).toString('base64'), signature);

    const pubKey: string = await this.readPublicSigningKey(id);
    return this.verifySignature(signature, data, pubKey);
  }

  async verifySignature(signature: string, data: string, publicKey: string): Promise<boolean> {
    // TODO: complete this stub...
    // this.client.verifySignature(vaultId, id, Buffer.from(data).toString('base64'), signature);

    return this.cryptographyService.validateSignature(signature, Buffer.from(data).toString('base64'), publicKey);
  }

  // FIXME-- this will go away once ident promises are handled...
  private checkResponse(response: AxiosResponse, context: string, expectedStatus = 200) {
    if (!response) {
      throw Error(`${context}: no response`);
    }
    if (response.status !== expectedStatus) {
      throw Error(`${context}: server responded ${response.status}`);
    }
  }
}
