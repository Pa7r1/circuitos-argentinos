import { CONTACTO, LegalLayout } from './LegalLayout';

/**
 * Términos y condiciones.
 *
 * El descargo del riesgo va en cláusulas numeradas porque la actividad es
 * peligrosa de verdad y los datos los aportan terceros. Arriba de todo hay un
 * resumen en lenguaje llano: si alguien lee una sola cosa de esta página, tiene
 * que ser esa, y no el punto 9.
 */
export function TerminosPage() {
  return (
    <LegalLayout titulo="Términos y condiciones">
      <div className="rounded-xl border border-amber-400/25 bg-amber-400/10 p-4 text-sm text-amber-50">
        <p className="mb-2 font-semibold text-white">En criollo, antes de arrancar</p>
        <p>
          Este sitio es una guía hecha por aficionados, no una autoridad. Los circuitos los cargan
          personas, la información puede estar vieja o equivocada, el terreno cambia y algunos
          accesos son privados o necesitan permiso. Andar en off-road es peligroso y lo hacés bajo
          tu propia responsabilidad: fijate vos que el lugar exista, que se pueda entrar y que
          estés en condiciones de andarlo.
        </p>
      </div>

      <h2>1. Qué es este servicio</h2>
      <p>
        Circuitos Argentinos es un sitio gratuito que muestra en un mapa circuitos off-road de
        enduro, motocross y ciclismo de montaña en Argentina, con su ficha y, cuando existe, el
        archivo GPX del recorrido o el enlace a la grabación en un servicio de terceros. Es
        información de referencia y nada más.
      </p>

      <h2>2. Al usarlo, aceptás estos términos</h2>
      <p>
        Usar el sitio o crear una cuenta implica que leíste y aceptás estos términos y la{' '}
        <a href="/privacidad">política de privacidad</a>. Si no estás de acuerdo con algo, no uses
        el servicio.
      </p>

      <h2>3. Naturaleza riesgosa de la actividad</h2>
      <ol>
        <li>
          <strong>Asumís el riesgo voluntariamente.</strong> El enduro, el motocross y el ciclismo
          de montaña son actividades físicas de riesgo, con posibilidad cierta de lesiones graves,
          permanentes o mortales. Al usar la información de este sitio para andar, aceptás ese
          riesgo por tu propia decisión.
        </li>
        <li>
          <strong>Sos responsable de tu estado y tu equipo.</strong> Antes de salir tenés que estar
          en condiciones físicas de hacerlo, con el vehículo o la bicicleta en condiciones y con el
          equipo de protección adecuado, incluido el casco. El sitio no verifica nada de eso.
        </li>
        <li>
          <strong>Sos responsable de evaluar el terreno.</strong> La dificultad indicada en una
          ficha es una referencia aportada por quien la cargó, no una medición. El estado real
          depende de la lluvia, la erosión, el tránsito y el paso del tiempo.
        </li>
        <li>
          <strong>El sitio no organiza ni supervisa nada.</strong> No hay eventos, no hay guías, no
          hay asistencia, no hay control de nadie en el lugar. Publicar un circuito no es
          convocarte a andarlo.
        </li>
      </ol>

      <h2>4. Exactitud de la información</h2>
      <ol start={5}>
        <li>
          Los datos —ubicación, distancia, dificultad, accesos, horarios, trazado— los aporta quien
          carga el circuito y pueden ser <strong>inexactos, incompletos o estar desactualizados</strong>.
          No se garantiza que un circuito exista, siga abierto o esté donde dice el mapa.
        </li>
        <li>
          Las coordenadas y los trazados son orientativos. No sirven como herramienta de navegación
          ni de rescate. Llevá tu propia forma de orientarte y de pedir ayuda.
        </li>
      </ol>

      <h2>5. Accesos y propiedad privada</h2>
      <ol start={7}>
        <li>
          Que un circuito figure acá <strong>no significa que tengas permiso para entrar</strong>.
          Muchos están en campos privados, en tierras de comunidades o en áreas con regulación
          propia. Averiguar y conseguir la autorización que corresponda es tu responsabilidad.
        </li>
        <li>
          Tenés que cumplir la normativa vigente: tránsito, ambiental, municipal, provincial y
          nacional, además de las reglas del lugar. El uso indebido de un acceso es exclusivamente
          tuyo.
        </li>
      </ol>

      <h2>6. Menores de edad</h2>
      <ol start={9}>
        <li>
          Para crear una cuenta hay que ser mayor de 18 años, o tener autorización de quien ejerza
          la responsabilidad parental. Si un menor practica la actividad, la supervisión y la
          responsabilidad son de sus padres, madres o tutores.
        </li>
      </ol>

      <h2>7. Limitación de responsabilidad</h2>
      <ol start={10}>
        <li>
          En la máxima medida que permita la legislación argentina, ni el responsable del sitio ni
          quienes colaboran con él responden por daños de ningún tipo —lesiones, muerte, daños al
          vehículo o a la bicicleta, pérdidas económicas, sanciones, conflictos con terceros—
          derivados del uso del sitio o de la información que muestra.
        </li>
        <li>
          El servicio se ofrece <strong>tal como está</strong>, sin garantía de disponibilidad,
          continuidad ni ausencia de errores. Puede dejar de funcionar o discontinuarse en
          cualquier momento y sin aviso.
        </li>
        <li>
          Esta limitación no alcanza a lo que la ley no permite limitar, en particular el dolo o la
          culpa grave.
        </li>
      </ol>

      <h2>8. Tu cuenta</h2>
      <ol start={13}>
        <li>
          Sos responsable de la contraseña de tu cuenta y de lo que se haga con ella. Si sospechás
          que alguien accedió, cambiala desde <a href="/">el ingreso</a> y avisanos.
        </li>
        <li>
          Podés borrar tu cuenta cuando quieras desde el menú de tu perfil. También podemos dar de
          baja una cuenta que use el servicio para dañar el sitio o a otras personas.
        </li>
      </ol>

      <h2>9. Circuitos que proponés</h2>
      <ol start={15}>
        <li>
          Si proponés un circuito, tiene que ser información tuya o que puedas compartir, y las
          fotos tenés que haberlas sacado vos o tener permiso para publicarlas. No subas fotos con
          personas identificables sin que estén de acuerdo.
        </li>
        <li>
          Al proponerlo, nos autorizás a publicarlo en el mapa, a corregirlo y a mostrarlo junto al
          resto del contenido del sitio. Podés pedir que lo saquemos escribiéndonos.
        </li>
        <li>
          Nada se publica automáticamente: revisamos cada propuesta y podemos no publicarla, sin
          que eso implique ningún juicio sobre el circuito ni sobre vos.
        </li>
        <li>
          No propongas lugares a los que no se pueda entrar, ni de propiedad privada sin permiso
          de quien corresponda.
        </li>
      </ol>

      <h2>10. Contenido de terceros</h2>
      <p>
        Las imágenes satelitales son de Esri, Maxar y Earthstar Geographics; el mapa de calles es
        de OpenStreetMap y quienes colaboran con él; la búsqueda de localidades usa la API Georef
        del Estado argentino. Los recorridos embebidos de Relive, Strava, Wikiloc, Komoot y Google
        My Maps pertenecen a esos servicios y a sus autores, y se rigen por sus propios términos.
      </p>

      <h2>11. Cambios</h2>
      <p>
        Estos términos pueden cambiar. La fecha de arriba indica la última revisión; seguir usando
        el sitio después de un cambio implica aceptarlo.
      </p>

      <h2>12. Ley aplicable</h2>
      <p>
        Se aplica la legislación de la República Argentina. Cualquier controversia se somete a los
        tribunales ordinarios competentes de la Provincia de La Rioja.
      </p>

      <h2>13. Contacto</h2>
      <p>
        Por cualquier consulta sobre estos términos, escribinos a{' '}
        <a href={`mailto:${CONTACTO}`}>{CONTACTO}</a>.
      </p>
    </LegalLayout>
  );
}
