import { Injectable, Logger } from '@nestjs/common';
import IpfsClient from 'ipfs-http-client';
import { FileManager } from '../file-manager.interface';

@Injectable()
export class IpfsFileManager implements FileManager {
  constructor(private readonly ipfs: IpfsClient) {}

  /**
   * Fetch a file from IPFS that is addressed by a valid IPFS Path.
   * https://github.com/ipfs/interface-js-ipfs-core/blob/master/SPEC/FILES.md#get
   * @param ipfsPath IPFS Path
   */
  async retrieve(ipfsPath: string): Promise<string> {
    try {
      Logger.debug(`Ipfs.retrieve: getting ${ipfsPath} from IPFS`);
      const [file] = await this.ipfs.get(ipfsPath);
      Logger.debug(`Ipfs.retrieve: got ${ipfsPath} from IPFS`);
      return JSON.parse(file.content.toString('utf8'));
    } catch (e) {
      throw e;
    }
  }

  /**
   * Add files and data to IPFS.
   * https://github.com/ipfs/interface-js-ipfs-core/blob/master/SPEC/FILES.md#add
   * @param data data message to be added to IPFS
   */
  async store(data: string): Promise<string> {
    // this will perform badly with huge messages
    // check later how to use streams
    const stringData = JSON.stringify(data);
    const bufferedData = Buffer.from(stringData, 'utf-8');
    let result;
    try {
      [result] = await this.ipfs.add(bufferedData);
    } catch (err) {
      Logger.debug(`IPFSFileManager.store: error: ${err.message}`);
    }
    if (result) {
      Logger.debug(`Ipfs.store: file ${result.path} shared via IPFS`);
      return result.path;
    } else {
      throw new Error('Ipfs.store: Error saving to Ipfs');
    }
  }
}
