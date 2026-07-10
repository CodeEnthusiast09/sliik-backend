import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { GoogleAuthDto } from './dto/google-auth.dto';
import { AppleAuthDto } from './dto/apple-auth.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
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

  @Post('forgot-password')
  @UseGuards(ThrottlerGuard)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.forgotPassword(dto);
    return successResponse(
      'If an account exists for that email, a reset code has been sent.',
    );
  }

  @Post('reset-password')
  @UseGuards(ThrottlerGuard)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto);
    return successResponse(
      'Password reset successful. You can now sign in with your new password.',
    );
  }

  @Post('verify-email')
  @UseGuards(ThrottlerGuard)
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    const data = await this.authService.verifyEmail(dto);
    return successResponse('Email verified successfully', data);
  }

  @Post('resend-verification')
  @UseGuards(ThrottlerGuard)
  async resendVerification(@Body() dto: ResendVerificationDto) {
    await this.authService.resendVerification(dto);
    return successResponse(
      'If an account needs verification, a new code has been sent.',
    );
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
