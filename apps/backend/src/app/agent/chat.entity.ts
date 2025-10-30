import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
} from 'typeorm';

@Entity('chats')
export class ChatEntity {
  @PrimaryColumn({ type: 'varchar', length: 32 })
  id!: string;

  @CreateDateColumn({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;

  @OneToMany(() => ChatMessageEntity, (message) => message.chat, {
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
  })
  messages!: ChatMessageEntity[];
}

@Entity('chat_messages')
export class ChatMessageEntity {
  @PrimaryColumn({ type: 'varchar', length: 32 })
  id!: string;

  @Column({ type: 'varchar', length: 32 })
  chatId!: string;

  @ManyToOne(() => ChatEntity, (chat) => chat.messages)
  @JoinColumn({ name: 'chat_id', referencedColumnName: 'id' })
  chat!: ChatEntity;

  @CreateDateColumn({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;

  @Column({ type: 'varchar', length: 32 })
  role!: string;

  @Column({ type: 'text' })
  text!: string;
}
