import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const SAMPLE_JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQEASABIAAD//gA7Q1JFQVRPUjogZ2QtanBlZyB2MS4wICh1c2luZyBJSkcgSlBFRyB2NjIpLCBxdWFsaXR5ID0gOTAK/9sAQwADAgIDAgIDAwMDBAMDBAUIBQUEBAUKBwcGCAwKDAwLCgsLDQ4SEA0OEQ4LCxAWEBETFBUVFQwPFxgWFBgSFBUU//bAEMBAwQEBQQFCQUFCRQNCw0UFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQU//AABEIAAEAAQMBIgACEQEDEQH/xAAfAAABBQEBAQEBAQAAAAAAAAAAAQIDBAUGBwgJCgv/xAC1EAACAQMDAgQDBQUEBAAAAX0BAgMABBEFEiExQQYTUWEHInEUMoGRoQgjQrHBFVLR8CQzYnKCCQoWFxgZGiUmJygpKjQ1Njc4OTpDREVGR0hJSlNUVVZXWFlaY2RlZmdoaWpzdHV2d3h5eoOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4eLj5OXm5+jp6vHy8/T19vf4+fr/2gAMAwEAAhEDEQA/APf6KKKAP//Z',
  'base64',
);

test('02-photo-meal: 上传照片 → preview 可见 → 确认入库', async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  await page.goto('/');
  const filePath = path.join('/tmp', `e2e-meal-${Date.now()}.jpg`);
  fs.writeFileSync(filePath, SAMPLE_JPEG);
  await page.locator('input[type="file"]').first().setInputFiles(filePath);
  await expect(page.getByRole('button', { name: /确认入库/ })).toBeVisible({ timeout: 5_000 });
  await page.getByRole('button', { name: /确认入库/ }).click();
  await page.waitForTimeout(500);
  fs.unlinkSync(filePath);
});
