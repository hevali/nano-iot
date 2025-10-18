import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

@Entity('devices')
export class DeviceEntity {
  @PrimaryColumn({ type: 'varchar', length: 32 })
  id!: string;

  @CreateDateColumn({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;

  @Column({ type: 'simple-json', default: '{}' })
  properties!: Record<string, any>;
}
