# Go Motel - Sistema de Gestión de Motel

Bienvenido a Go Motel, una aplicación web moderna y completa diseñada para simplificar y automatizar la gestión de las operaciones de un motel. Construida con un stack tecnológico de vanguardia, esta aplicación ofrece una solución robusta y escalable para el manejo de habitaciones, reservaciones, inventario, facturación y mucho más.

## 🚀 Arquitectura Tecnológica

La aplicación está construida sobre una base sólida de tecnologías modernas, elegidas por su rendimiento, escalabilidad y excelente experiencia de desarrollo:

- **Framework**: **Next.js 15** utilizando el **App Router** para un enrutamiento optimizado y renderizado del lado del servidor (SSR) y del cliente (CSR).
- **Lenguaje**: **TypeScript** para un código robusto, escalable y con tipado estático que previene errores en tiempo de desarrollo.
- **Backend y Base de Datos**: **Firebase** como plataforma de backend, utilizando:
  - **Firestore**: Como base de datos NoSQL en tiempo real para una sincronización de datos instantánea.
  - **Firebase Authentication**: Para una gestión segura de la autenticación de usuarios por correo y contraseña.
- **Interfaz de Usuario (UI)**:
  - **React**: Para la construcción de interfaces de usuario dinámicas y reactivas.
  - **ShadCN UI**: Una colección de componentes de UI reutilizables, personalizables y accesibles, construidos sobre Radix UI y Tailwind CSS.
  - **Tailwind CSS**: Para un diseño rápido y utilitario que permite crear interfaces complejas sin salir del HTML.
- **Gestión de Formularios**: **React Hook Form** para un manejo de formularios performante y flexible, combinado con **Zod** para una validación de esquemas potente y con inferencia de tipos.
- **Gestión de Estado**: Una combinación de **React Hooks (`useState`, `useContext`)** y la API de Contexto de React para un manejo de estado ligero y localizado, evitando la complejidad de librerías de estado global más pesadas.
- **Inteligencia Artificial**: Integración con **Genkit** para capacidades de IA, como la generación de resúmenes de estado y la automatización de tareas.
- **Despliegue**: Optimizado para **Firebase App Hosting**.

## ✨ Características Principales

El sistema está diseñado para cubrir todas las áreas críticas de la gestión de un motel:

- **Panel de Habitaciones**: Visualización en tiempo real del estado de todas las habitaciones (Disponible, Ocupada, Limpieza, Mantenimiento).
- **Gestión de Reservaciones y Estancias**:
  - Creación de reservaciones futuras y check-ins inmediatos (walk-in).
  - Gestión de estancias activas, incluyendo extensiones de tiempo.
  - Lógica de facturación flexible con opciones de "Cuenta Abierta" o pago por adelantado.
- **Control de Inventario**:
  - Catálogo de productos diferenciando entre comprados (con stock) y de producción interna.
  - Registro de facturas de compra que actualizan el stock automáticamente.
  - Deducción automática de stock al realizar pedidos de servicio.
- **Gestión de Clientes (CRM)**: Base de datos de clientes para agilizar el check-in y ofrecer un servicio personalizado, con la capacidad de marcar clientes VIP.
- **Facturación y Pagos**:
  - Generación automática de facturas para pagos adelantados y check-outs con desglose de impuestos.
  - Soporte para múltiples métodos de pago: **Efectivo** (con cálculo de vuelto), **Tarjeta** (con registro de voucher) y **SINPE Móvil**.
  - Sistema de rotación automática de cuentas SINPE Móvil para gestionar límites de saldo.
- **Reportes y Consultas**:
  - Historial detallado de Estancias, Facturas y Compras a proveedores.
  - Vista en tiempo real del inventario para control de stock.
- **Administración del Sistema**:
  - Configuración de tipos de habitación con planes de precios personalizables.
  - Gestión de impuestos, proveedores y cuentas de pago.
- **Roles y Permisos**: Sistema de roles simple para controlar el acceso a diferentes funcionalidades:
  - **Administrador**: Control total del sistema, incluyendo configuración y gestión de usuarios.
  - **Recepcion**: Acceso a las operaciones diarias del motel (reservaciones, check-in, etc.).

## 📁 Estructura del Proyecto

La organización del código está diseñada para ser intuitiva y escalable:

- `src/app/`: Contiene todas las páginas y rutas de la aplicación, siguiendo la convención del App Router de Next.js.
- `src/components/`: Alberga todos los componentes de React reutilizables, organizados por funcionalidad.
- `src/lib/actions/`: Centraliza todas las **Server Actions** de Next.js. Aquí reside la lógica de negocio principal que interactúa con la base de datos.
- `src/firebase/`: Contiene la configuración de Firebase, los providers de contexto y los hooks personalizados (`useFirebase`, `useCollection`, `useDoc`) para interactuar con los servicios de Firebase de forma reactiva.
- `src/types/`: Definiciones de todas las interfaces de TypeScript utilizadas en el proyecto, garantizando la consistencia de los datos.
- `docs/backend.json`: Un archivo fundamental que actúa como el "plano" de la arquitectura de datos, definiendo todas las entidades y su estructura en Firestore.
- `firestore.rules`: Reglas de seguridad de Firestore para proteger la base de datos (actualmente configurado para permitir todo en el entorno de desarrollo).

## 🔑 Flujos de Negocio Clave

1.  **Ciclo de Vida del Huésped**:
    - Un cliente reserva (`/reservations`) -> La reservación queda 'Confirmada'.
    - El cliente llega y hace check-in -> Se crea una `estancia` y la habitación pasa a 'Ocupada'.
    - Durante la estancia, se pueden añadir `pedidos` y `extensiones`.
    - Al finalizar, se hace check-out -> Se genera la `factura` final, y la habitación pasa a 'Limpieza'.
    - El personal limpia la habitación y la marca como 'Disponible', cerrando el ciclo.

2.  **Flujo de Inventario**:
    - Se registra una `factura de compra` de un `proveedor` (`/purchases`).
    - El `stock` de los productos en la factura se actualiza automáticamente.
    - Cuando un cliente realiza un `pedido` (`/rooms/[id]`), el `stock` de los productos se descuenta.
    - Se puede registrar `merma` para ajustar el inventario por pérdidas.

## 🏁 Cómo Empezar

Este es un proyecto de Firebase Studio. Para ejecutarlo localmente:

1.  **Instalar dependencias**:
    ```bash
    npm install
    ```
2.  **Ejecutar el servidor de desarrollo**:
    ```bash
    npm run dev
    ```
La aplicación estará disponible en `http://localhost:9002`.
