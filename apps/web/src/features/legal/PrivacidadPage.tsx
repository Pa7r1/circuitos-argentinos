import { CONTACTO, LegalLayout } from './LegalLayout';

/**
 * Política de privacidad, escrita contra lo que la app realmente hace: si acá dice
 * que se puede borrar la cuenta, el endpoint tiene que existir (DELETE /auth/me).
 * Al agregar cualquier dato nuevo que se guarde, este texto se actualiza también.
 */
export function PrivacidadPage() {
  return (
    <LegalLayout titulo="Política de privacidad">
      <p>
        Esta política explica qué datos personales se recogen en Circuitos Argentinos, para qué se
        usan y cómo ejercer tus derechos. Se rige por la{' '}
        <strong>Ley 25.326 de Protección de los Datos Personales</strong> de la República
        Argentina.
      </p>

      <h2>Quién es responsable</h2>
      <p>
        El responsable del tratamiento es <strong>Patricio Carpio</strong>. Para cualquier consulta
        o para ejercer tus derechos: <a href={`mailto:${CONTACTO}`}>{CONTACTO}</a>.
      </p>

      <h2>Qué datos se guardan</h2>
      <ul>
        <li>
          <strong>De tu cuenta</strong>: nombre, email, la disciplina que elegiste y la fecha en
          que aceptaste los términos. La contraseña <strong>no</strong> se guarda: se guarda un
          hash bcrypt, del que no se puede volver a la contraseña original.
        </li>
        <li>
          <strong>Registros técnicos</strong>: el servidor anota los pedidos que recibe (fecha,
          dirección IP, ruta) para poder investigar errores y abusos. No se registran los cuerpos
          de los pedidos ni las contraseñas.
        </li>
        <li>
          <strong>Lo que cargue el administrador</strong>: los circuitos, sus fotos y sus archivos
          GPX. Ojo: una foto puede mostrar personas o vehículos, y un GPX contiene el recorrido
          exacto de quien lo grabó.
        </li>
        <li>
          <strong>Si proponés un circuito</strong>: los datos del circuito, las fotos que subas y
          un <strong>teléfono de contacto</strong>. El teléfono se usa solo para escribirte si
          falta algún dato o hay que corregir algo, <strong>no se publica</strong> en el mapa ni
          en la ficha, y solo lo ve el administrador. Si borrás tu cuenta se elimina; el circuito,
          si ya se publicó, queda en el mapa sin ningún dato tuyo.
        </li>
      </ul>

      <h2>Tu ubicación</h2>
      <p>
        Si le das permiso al navegador, el mapa usa tu ubicación para centrarse y ordenar los
        circuitos por cercanía. Ese cálculo pasa <strong>dentro de tu dispositivo</strong>: la
        ubicación no se manda al servidor ni queda guardada en ninguna parte. Podés usar el mapa
        sin dar ese permiso.
      </p>

      <h2>Almacenamiento en tu navegador</h2>
      <p>
        No se usan cookies de seguimiento, ni analítica, ni publicidad, ni herramientas de
        terceros que te perfilen. El sitio guarda dos cosas en el almacenamiento local de tu propio
        navegador: <strong>tu sesión</strong> (para no pedirte la contraseña en cada visita) y una
        marca de qué recorridos guiados ya viste. Se borran al cerrar sesión o al limpiar los datos
        del navegador desde su configuración.
      </p>

      <h2>Para qué se usan</h2>
      <ul>
        <li>Dar acceso a la ficha completa de los circuitos, que exige tener cuenta.</li>
        <li>Mandarte el correo para recuperar la contraseña, si lo pedís.</li>
        <li>Mantener el servicio en pie y detectar abusos.</li>
      </ul>
      <p>
        <strong>No se venden ni se ceden</strong> tus datos a terceros, ni se te manda publicidad.
      </p>

      <h2>Quién más los procesa</h2>
      <p>
        Para funcionar, el sitio se apoya en proveedores que procesan datos por cuenta del
        responsable: <strong>Neon</strong> (base de datos), <strong>Render</strong> (servidor de la
        API), <strong>Cloudflare</strong> (publicación del sitio) y <strong>Resend</strong>{' '}
        (envío del correo de recuperación, que recibe tu dirección solo cuando pedís uno). Algunos
        tienen servidores fuera de la Argentina.
      </p>

      <h2>Cuánto tiempo</h2>
      <p>
        Los datos de tu cuenta se guardan mientras la cuenta exista. Al borrarla se eliminan de la
        base. Los registros técnicos del servidor se conservan por un plazo breve, el que fije cada
        proveedor.
      </p>

      <h2>Tus derechos</h2>
      <p>
        Tenés derecho a acceder a tus datos, rectificarlos, actualizarlos y suprimirlos. Dos de
        ellos están directamente en la aplicación:
      </p>
      <ul>
        <li>
          <strong>Ver tus datos</strong>: son los que aparecen en el menú de tu cuenta.
        </li>
        <li>
          <strong>Borrar tu cuenta</strong>: desde el menú de tu cuenta, opción &laquo;Borrar mi
          cuenta&raquo;. Es inmediato y no se puede deshacer.
        </li>
      </ul>
      <p>
        Para cualquier otro pedido, escribinos a <a href={`mailto:${CONTACTO}`}>{CONTACTO}</a>. La
        Agencia de Acceso a la Información Pública, en su carácter de órgano de control de la Ley
        25.326, atiende las denuncias de quien entienda afectados sus derechos.
      </p>

      <h2>Seguridad</h2>
      <p>
        Todo el tráfico viaja cifrado por HTTPS, las contraseñas se guardan con bcrypt y el acceso
        a la ficha completa exige una sesión válida. Ninguna medida es infalible: si detectamos un
        incidente que te afecte, te lo vamos a informar.
      </p>

      <h2>Cambios</h2>
      <p>
        Si esta política cambia, se actualiza la fecha de arriba. Los cambios importantes se avisan
        dentro de la aplicación.
      </p>
    </LegalLayout>
  );
}
