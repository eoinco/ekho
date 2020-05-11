import { FactoryProvider } from '@nestjs/common/interfaces';
import { ConfigService } from '@nestjs/config';
import { ChainManager } from './chain-manager.interface';
import { DBChainManager } from './implementations/chain-manager-db';
import { InfuraChainManager } from './implementations/chain-manager-infura';

import Web3 from 'web3';
import { EventsService } from '../events/events.service';

export const chainManagerFactory: FactoryProvider<ChainManager> = {
  provide: 'ChainManager',
  useFactory: (config: ConfigService, event: EventsService): ChainManager => {
    const builders = {
      infura: (): ChainManager => {
        const rpcUrl = config.get('web3.rpcUrl');
        const web3 = new Web3(new Web3.providers.WebsocketProvider(rpcUrl));
        return new InfuraChainManager(config, web3, event);
      },
      db: (): ChainManager => {
        return new DBChainManager(event);
      },
    };
    const type = config.get<string>('chainmanager.type');
    const builder = builders[type];
    if (!builder) {
      throw Error(
        `Unexpected chain-manager.type value: ${type ? type : 'undefined (missing CHAIN_MANAGER_TYPE in .env)'}`,
      );
    }
    return builder();
  },
  inject: [ConfigService, EventsService],
};
