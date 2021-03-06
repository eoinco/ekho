import { fakerFactory } from '../../../test/test-helpers';
import { User } from '../entities/users.entity';

const anonUser: User = {
  id: '',
  name: 'anon-user',
  channelmembers: [],
  contacts: [],
  broadcastchannels: [],
  accessToken: '',
  refreshToken: '',
};

export const fakeUser = fakerFactory<User>(anonUser);
