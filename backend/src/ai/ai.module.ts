import { Module } from '@nestjs/common';
import { AiClient } from './ai.client';

/** Its own module because meetings and requirements will reuse the client. */
@Module({
  providers: [AiClient],
  exports: [AiClient],
})
export class AiModule {}
