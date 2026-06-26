# Reglas de Interfaz de Usuario (UI)

- **Modals**: Nunca utilices el componente `Modal` nativo (ni de `react-native` ni de librerías de terceros) de forma directa. Todos los modales en la aplicación deben utilizar el componente compartido `<CourtUpModal>` (`@/components/CourtUpModal`) que ya tiene nuestros estilos premium, el overlay correcto y soporte nativo para los colores del tema.
