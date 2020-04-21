import { QueryRunner, Repository } from 'typeorm';
import { CryptographyService } from '../../cryptography/cryptography.service';
import { User } from '../../users/entities/users.entity';
import { KeyManager } from '../key-manager.interface';
import { DbKeyPair } from './key-manager-db.entity';

export class DbKeyManager implements KeyManager {
  constructor(
    private readonly keypairRepository: Repository<DbKeyPair>,
    private readonly cryptographyService: CryptographyService,
  ) {}

  async createSigningKey(id: string, queryRunner: QueryRunner): Promise<void> {
    const { privateKey, publicKey } = this.cryptographyService.generateSigningKeyPair();
    const user = new User();
    user.id = id;
    const keypair: DbKeyPair = new DbKeyPair();
    keypair.privateKey = privateKey;
    keypair.publicKey = publicKey;
    keypair.user = user;
    await queryRunner.manager.save('db_key_pair', keypair);
  }

  async readPublicSigningKey(id: string): Promise<string> {
    const keyPair = await this.keypairRepository.findOneOrFail({ select: ['publicKey'], where: { user: { id } } });
    return keyPair.publicKey;
  }

  async sign(id: string, data: string): Promise<string> {
    const keyPair = await this.keypairRepository.findOneOrFail({ select: ['privateKey'], where: { user: { id } } });
    return this.cryptographyService.generateSignature(data, keyPair.privateKey);
  }

  async verifySignatureById(id: string, signature: string, data: string): Promise<boolean> {
    const pubKey: string = await this.readPublicSigningKey(id);
    return this.verifySignature(signature, data, pubKey);
  }

  async verifySignature(signature: string, data: string, publicKey: string): Promise<boolean> {
    return this.cryptographyService.validateSignature(signature, data, publicKey);
  }
}
