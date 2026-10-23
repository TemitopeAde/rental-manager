import { items } from '@wix/data';
import { auth } from '@wix/essentials';

export interface Row {
  _id: string;
  [key: string]: unknown;
}

export interface Access {
  elevate: boolean;
}

function insertFn(access: Access) {
  return access.elevate ? auth.elevate(items.insert) : items.insert;
}

function updateFn(access: Access) {
  return access.elevate ? auth.elevate(items.update) : items.update;
}

function getFn(access: Access) {
  return access.elevate ? auth.elevate(items.get) : items.get;
}

function removeFn(access: Access) {
  return access.elevate ? auth.elevate(items.remove) : items.remove;
}

function bulkRemoveFn(access: Access) {
  return access.elevate ? auth.elevate(items.bulkRemove) : items.bulkRemove;
}

function queryFn(access: Access) {
  return access.elevate ? auth.elevate(items.query) : items.query;
}

export async function insertRow(
  collectionId: string,
  item: Record<string, unknown>,
  access: Access,
): Promise<Row> {
  return insertFn(access)(collectionId, item as Row) as Promise<Row>;
}

export async function updateRow(collectionId: string, item: Row, access: Access): Promise<Row> {
  return updateFn(access)(collectionId, item) as Promise<Row>;
}

export async function getRow(collectionId: string, itemId: string, access: Access): Promise<Row | null> {
  const found = await getFn(access)(collectionId, itemId);
  return (found as Row | null) ?? null;
}

export async function removeRow(collectionId: string, itemId: string, access: Access): Promise<void> {
  await removeFn(access)(collectionId, itemId);
}

export async function removeRows(collectionId: string, itemIds: string[], access: Access): Promise<void> {
  if (itemIds.length === 0) return;
  await bulkRemoveFn(access)(collectionId, itemIds);
}

export function queryRows(collectionId: string, access: Access) {
  return queryFn(access)(collectionId);
}

export function isDuplicateError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /duplicate|already exists|WDE0074|WD_DUPLICATE/i.test(message);
}
