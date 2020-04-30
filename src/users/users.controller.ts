import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import CreateUserDto from './dto/create-user.dto';
import UserDto from './dto/user.dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly userService: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Body() user: CreateUserDto): Promise<UserDto> {
    return this.userService.create(user);
  }

  @Get()
  async get(@Query('name') name: string): Promise<UserDto> {
    return this.userService.findByName(name);
  }
}
