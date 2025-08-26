import { Global, Module, OnModuleDestroy, Inject } from '@nestjs/common';
import { db } from './pg';
import { PG_DB, PG_POOL } from './tokens';

@Global()
@Module({
  providers: [
    { provide: PG_DB, useValue: db },
    { provide: PG_POOL, useFactory: () => db.pool },
    // Service para manejar lifecycle y cerrar el pool ordenadamente
    {
      provide: 'PG_LIFECYCLE',
      useFactory: () => {
        return new (class PgLifecycle implements OnModuleDestroy {
          async onModuleDestroy() {
            await db.$disconnect();
          }
        })();
      },
    },
  ],
  exports: [PG_DB, PG_POOL],
})
export class DatabaseModule {}
