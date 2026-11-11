import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { z } from 'zod';
import { Ctx, Roles } from '../common/decorators.js';
import type { RequestContext } from '../common/types.js';
import { ZodValidationPipe } from '../common/zod.pipe.js';
import { PlatformService } from './platform.service.js';

const setModulesSchema = z.object({
  enabledModules: z.array(z.string().trim().min(1).max(40)).max(32),
});

@Roles('PLATFORM_OPERATOR')
@Controller('platform')
export class PlatformController {
  constructor(private readonly platform: PlatformService) {}

  @Get('organizations')
  list() {
    return this.platform.listOrganizations();
  }

  @Put('organizations/:id/modules')
  setModules(
    @Ctx() ctx: RequestContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(setModulesSchema)) body: { enabledModules: string[] },
  ) {
    return this.platform.setModules(ctx.user.id, id, body.enabledModules);
  }
}
