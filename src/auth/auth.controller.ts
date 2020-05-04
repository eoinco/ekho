import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import TestDataDto from './dto/test-body.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

@ApiBearerAuth()
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('test/get-token')
  async login(@Query('userId') userId: string): Promise<any> {
    return this.authService.getToken(userId);
  }

  // test querystring userId passed in
  @UseGuards(JwtAuthGuard)
  @Get('test/query')
  async testQueryStringAuth(@Query('userId') userId: string): Promise<string> {
    return 'successful ' + userId;
  }

  // test body postdata userId passed in
  @UseGuards(JwtAuthGuard)
  @Post('test/body')
  async testBodyAuth(@Body() testData: TestDataDto): Promise<string> {
    return 'successful ' + testData.userId;
  }
}
