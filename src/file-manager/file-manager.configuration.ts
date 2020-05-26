export default () => ({
  filemanager: {
    type: process.env.FILE_MANAGER_TYPE,
    ipfs: {
      host: process.env.IPFS_HOST,
      port: parseInt(process.env.IPFS_PORT, 10) || 5001,
      protocol: process.env.IPFS_PROTOCOL || 'https',
    },
  },
});

export const mockFileManagerConfigValues = { filemanager: { host: '127.0.0.1', port: '8080', protocol: 'http' } };
