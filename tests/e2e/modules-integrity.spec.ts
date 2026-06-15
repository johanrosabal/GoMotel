import { test, expect } from '@playwright/test';

test.describe('Verificación de Integridad de Módulos (POMs)', () => {

  test.beforeEach(async ({ page }) => {
    // Iniciar sesión con las credenciales de prueba proporcionadas
    await page.goto('/login');
    await page.fill('[data-testid="login-email-input"]', 'johan.rosabal@gmail.com');
    await page.fill('[data-testid="login-password-input"]', 'Snap1234!');
    await page.click('[data-testid="login-submit-button"]');
    
    // Esperar a que el sistema redirija al dashboard tras validar
    await page.waitForURL('**/dashboard**', { timeout: 15000 });
  });

  test('Módulo Cocina Operativo', async ({ page }) => {
    await page.goto('/kitchen');
    
    const container = page.locator('[data-testid="orderqueuepage-main-div"]');
    
    // Esperamos a que el contenedor principal esté visible.
    await expect(container).toBeVisible({ timeout: 10000 });
  });

  test('Módulo Bar Operativo', async ({ page }) => {
    await page.goto('/bar');
    const container = page.locator('[data-testid="orderqueuepage-main-div"]');
    await expect(container).toBeVisible({ timeout: 10000 });
  });

  test('Módulo Limpieza Operativo', async ({ page }) => {
    await page.goto('/cleaning');
    const container = page.locator('[data-testid="cleaning-root-container"]');
    await expect(container).toBeVisible({ timeout: 10000 });
  });

  test('Módulo Clientes Operativo', async ({ page }) => {
    await page.goto('/clients');
    const container = page.locator('[data-testid="clients-root-container"]');
    await expect(container).toBeVisible({ timeout: 10000 });
  });

  test('Módulo Facturación Operativo', async ({ page }) => {
    await page.goto('/billing/invoices');
    const container = page.locator('[data-testid="invoices-root-container"]');
    await expect(container).toBeVisible({ timeout: 10000 });
  });

  test('Botón Diagnóstico en Configuración', async ({ page }) => {
    await page.goto('/settings/stability');
    const btn = page.locator('[data-testid="stability-action-button"]');
    await expect(btn).toBeVisible({ timeout: 10000 });
  });

});
