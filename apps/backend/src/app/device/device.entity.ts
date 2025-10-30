import { RpcParams } from 'jsonrpc-lite';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
} from 'typeorm';

@Entity('devices')
export class DeviceEntity {
  @PrimaryColumn({ type: 'varchar', length: 32 })
  id!: string;

  @CreateDateColumn({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;

  @Column({ type: 'simple-json', default: '{}' })
  properties!: Record<string, any>;

  @OneToMany(() => DeviceMethodEntity, (method) => method.device, {
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
  })
  methods!: DeviceMethodEntity[];
}

@Entity('device_methods')
export class DeviceMethodEntity {
  @PrimaryColumn({ type: 'varchar', length: 32 })
  deviceId!: string;

  @ManyToOne(() => DeviceEntity, (device) => device.methods)
  @JoinColumn({ name: 'device_id', referencedColumnName: 'id' })
  device!: DeviceEntity;

  @PrimaryColumn({ type: 'varchar', length: 128 })
  name!: string;

  @Column({ type: 'varchar', length: 512 })
  description!: string;

  @Column({ type: 'simple-json', default: '{}' })
  definition!: {
    params: RpcParams;
    result: unknown;
  };
}
