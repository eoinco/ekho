import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import chainManagerConfiguration from './chain-manager/chain-manager.configuration';
import { ChainManagerModule } from './chain-manager/chain-manager.module';
import { ChannelsModule } from './channels/channels.module';
import { ContactsModule } from './contacts/contacts.module';
import { DevelopmentModule } from './development/development.module';
import fileManagerConfiguration from './file-manager/file-manager.configuration';
import keyManagerConfiguration from './key-manager/key-manager.configuration';
import { KeyManagerModule } from './key-manager/key-manager.module';
import { UsersModule } from './users/users.module';
import web3Configuration from './web3/web3.configuration';

@Module({
  imports: [
    GraphQLModule.forRoot({
      include: [AuthModule, UsersModule, ContactsModule, DevelopmentModule],
      playground: true,
      autoSchemaFile: 'schema.gql',
    }),
    TypeOrmModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
      load: [chainManagerConfiguration, keyManagerConfiguration, fileManagerConfiguration, web3Configuration],
    }),
    UsersModule,
    ContactsModule,
    ChannelsModule,
    DevelopmentModule,
    KeyManagerModule,
    ChainManagerModule,
    AuthModule,
  ],
})
export class AppModule {}
