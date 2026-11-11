import { Body, Controller, Get, Headers, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import {
  inviteUserSchema,
  loginSchema,
  registerOrganizationSchema,
} from '@school-erp/shared';
import { Ctx, Public, Roles } from '../common/decorators.js';
import type { RequestContext } from '../common/types.js';
import { ZodValidationPipe } from '../common/zod.pipe.js';
import { AuthService } from './auth.service.js';
import { appConfig } from '../config.js';

const REFRESH_COOKIE = 'erp_refresh';

type IssuedSession = Awaited<ReturnType<AuthService['login']>>;

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** Native clients cannot read the httpOnly cookie, so they send X-Client: mobile. */
  private wantsRefreshInBody(client?: string) {
    return client?.trim().toLowerCase() === 'mobile';
  }

  private toClientSession(session: IssuedSession, includeRefresh: boolean) {
    return {
      accessToken: session.accessToken,
      user: session.user,
      campusId: session.campusId,
      organizationId: session.organizationId,
      role: session.role,
      enabledModules: session.enabledModules,
      ...(includeRefresh ? { refreshToken: session.refreshToken } : {}),
    };
  }

  private setRefreshCookie(res: Response, token: string) {
    res.cookie(REFRESH_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      // Must match Nest global prefix + controller path so refresh can read it.
      path: '/api/auth',
      maxAge: appConfig.refreshTtlSec * 1000,
    });
  }

  @Public()
  @Post('register')
  async register(
    @Body(new ZodValidationPipe(registerOrganizationSchema)) body: unknown,
    @Res({ passthrough: true }) res: Response,
    @Headers('x-client') client?: string,
  ) {
    const session = await this.auth.registerOrganization(body as never);
    this.setRefreshCookie(res, session.refreshToken);
    return this.toClientSession(session, this.wantsRefreshInBody(client));
  }

  @Public()
  @Post('login')
  async login(
    @Body(new ZodValidationPipe(loginSchema)) body: unknown,
    @Res({ passthrough: true }) res: Response,
    @Headers('x-client') client?: string,
  ) {
    const session = await this.auth.login(body as never);
    this.setRefreshCookie(res, session.refreshToken);
    return this.toClientSession(session, this.wantsRefreshInBody(client));
  }

  @Public()
  @Post('refresh')
  async refresh(
    @Res({ passthrough: true }) res: Response,
    @Body() body: { refreshToken?: string },
    @Headers('x-client') client?: string,
  ) {
    const token = body.refreshToken ?? (res.req as { cookies?: Record<string, string> }).cookies?.[REFRESH_COOKIE];
    if (!token) return { accessToken: null };
    const session = await this.auth.refresh(token);
    this.setRefreshCookie(res, session.refreshToken);
    return this.toClientSession(session, this.wantsRefreshInBody(client));
  }

  @Public()
  @Post('logout')
  async logout(
    @Res({ passthrough: true }) res: Response,
    @Body() body: { refreshToken?: string },
  ) {
    const token =
      body?.refreshToken ??
      (res.req as { cookies?: Record<string, string> }).cookies?.[REFRESH_COOKIE];
    await this.auth.logout(token);
    res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
    return { ok: true };
  }

  @Get('me')
  me(@Ctx() ctx: RequestContext) {
    return {
      user: ctx.user,
      campusId: ctx.campusId,
      organizationId: ctx.organizationId,
      role: ctx.role,
      enabledModules: ctx.enabledModules,
    };
  }

  @Roles('ORG_OWNER', 'CAMPUS_ADMIN')
  @Post('invite')
  invite(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(inviteUserSchema)) body: unknown,
  ) {
    return this.auth.invite(body as never, ctx.user, ctx.organizationId, ctx.role, ctx.campusId);
  }
}
