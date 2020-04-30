import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Contact } from './contacts.entity';
import { ContactsService } from './contacts.service';
import ContactHandshakeDto from './dto/contact-handshake.dto';
import ContactDto from './dto/contact.dto';

@Controller('contacts')
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @UseGuards(JwtAuthGuard)
  @Get(':userId')
  async getContactsForUser(@Param('userId') userId: string): Promise<ContactDto[]> {
    return this.contactsService.getByUser(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':userId/:contactId')
  async findContactByUser(@Param('userId') userId: string, @Param('contactId') contactId: number): Promise<Contact> {
    return this.contactsService.findOneContact(userId, contactId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('generate-init-handshake/:userId/:contactName')
  async initHandshake(
    @Param('userId') userId: string,
    @Param('contactName') contactName: string,
  ): Promise<ContactHandshakeDto> {
    return this.contactsService.initHandshake(userId, contactName);
  }

  @UseGuards(JwtAuthGuard)
  @Post('accept-init-handshake/:userId/:contactName')
  async acceptInitHandshake(
    @Param('userId') userId: string,
    @Param('contactName') contactName: string,
    @Body() initHandshake: ContactHandshakeDto,
  ): Promise<void> {
    await this.contactsService.acceptInitHandshake(userId, contactName, initHandshake);
  }

  @UseGuards(JwtAuthGuard)
  @Post('generate-reply-handshake/:userId/:contactName')
  async generateReplyHandshake(
    @Param('userId') userId: string,
    @Param('contactName') contactName: string,
  ): Promise<ContactHandshakeDto> {
    return this.contactsService.replyHandshake(userId, contactName);
  }

  @UseGuards(JwtAuthGuard)
  @Post('accept-reply-handshake/:userId/:contactName')
  async acceptReplyHandshake(
    @Param('userId') userId: string,
    @Param('contactName') contactName: string,
    @Body() replyHandshake: ContactHandshakeDto,
  ): Promise<void> {
    await this.contactsService.acceptReplyHandshake(userId, contactName, replyHandshake);
  }
}
