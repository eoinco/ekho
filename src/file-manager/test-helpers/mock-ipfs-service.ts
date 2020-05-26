import { IpfsFileManager } from '../implementations/file-manager-ipfs';

export const mockIpfsService: jest.Mock<Omit<IpfsFileManager, 'ipfs'>> = jest.fn(() => {
  return {
    retrieve: jest.fn(),
    store: jest.fn(),
  };
});
