import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { GoogleAuthDto } from './dto/google-auth.dto';
import { AppleAuthDto } from './dto/apple-auth.dto';
import { successResponse } from '../../common/utils/response.helper';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    const data = await this.authService.register(dto);
    return successResponse('Registration successful', data);
  }

  @Post('login')
  async login(@Body() dto: LoginDto) {
    const data = await this.authService.login(dto);
    return successResponse('Login successful', data);
  }

  @Post('google')
  async googleAuth(@Body() dto: GoogleAuthDto) {
    const data = await this.authService.googleAuth(dto);
    return successResponse('Google authentication successful', data);
  }

  @Post('apple')
  async appleAuth(@Body() dto: AppleAuthDto) {
    const data = await this.authService.appleAuth(dto);
    return successResponse('Apple authentication successful', data);
  }
}
