import { PermissionFlagsBits } from 'discord.js';
import { adminRoleId } from '../config.js';

export function isAdminMember(member) {
  if (!member) return false;
  if (member.permissions?.has(PermissionFlagsBits.Administrator)) return true;
  if (adminRoleId && member.roles?.cache?.has(adminRoleId)) return true;
  return false;
}
