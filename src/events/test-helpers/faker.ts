import { fakerFactory } from '../../../test/test-helpers';
import { EkhoEvent } from '../entities/events.entity';
/* tslint:disable prefer-const no-var no-var-keyword */

var anonEvent: EkhoEvent = {
  id: 'uuid12345',
  txHash: '0x123',
  status: 'DERP',
  createdDate: new Date(0),
  channelId: 'ANON_CHANNELID',
  content: 'lalala',
  signature: 'Made in Ireland',
  block: 1,
  channelmessages: null,
};

export const fakeEvent = fakerFactory<EkhoEvent>(anonEvent);
