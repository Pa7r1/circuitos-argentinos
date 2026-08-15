import { describe, expect, it } from 'vitest';
import { parsearPlantilla } from '../src/features/admin/pegar-datos';

/** La respuesta que llega por WhatsApp, tal cual la escribe una persona. */
const MENSAJE = `
Nombre: Quebrada del Cóndor
Disciplina: Enduro
Provincia: La Rioja
Localidad: Chilecito
Dificultad: Intermedio
Acceso: Libre
Notas de acceso: Se entra por la ruta 40, tranquera abierta todo el año
Distancia: 12,5 km
Desnivel: 340 m
Enlace: https://www.relive.com/es/view/vQvykNrjW46
Descripción: Arena floja los primeros kilómetros y después piedra suelta.
`;

describe('parsearPlantilla', () => {
  it('completa la planilla entera', () => {
    const { campos, ignoradas } = parsearPlantilla(MENSAJE);
    expect(ignoradas).toEqual([]);
    expect(campos).toEqual({
      name: 'Quebrada del Cóndor',
      discipline: 'enduro',
      province: 'la-rioja',
      locality: 'Chilecito',
      difficulty: 'intermedio',
      accessType: 'libre',
      accessNotes: 'Se entra por la ruta 40, tranquera abierta todo el año',
      km: '12,5',
      desnivel: '340',
      externalMapUrl: 'https://www.relive.com/es/view/vQvykNrjW46',
      description: 'Arena floja los primeros kilómetros y después piedra suelta.',
    });
  });

  it('perdona tildes, mayúsculas, sinónimos y viñetas', () => {
    const { campos } = parsearPlantilla(
      ['- CIRCUITO: Cerro Negro', '* Dificultad: avanzado', 'Tipo de acceso: Arancelado', 'Ciudad: Anillaco'].join(
        '\n',
      ),
    );
    expect(campos.name).toBe('Cerro Negro');
    expect(campos.difficulty).toBe('dificil');
    expect(campos.accessType).toBe('pago');
    expect(campos.locality).toBe('Anillaco');
  });

  it('avisa de lo que no entendió y deja el resto', () => {
    const { campos, ignoradas } = parsearPlantilla(
      ['Nombre: El Zanjón', 'Provincia: Sarasa', 'Dificultad: imposible'].join('\n'),
    );
    expect(campos.name).toBe('El Zanjón');
    expect(campos.province).toBeUndefined();
    expect(ignoradas).toEqual(['provincia', 'dificultad']);
  });

  it('ignora renglones vacíos, saludos y texto suelto', () => {
    const { campos, ignoradas } = parsearPlantilla(
      ['Hola! te paso los datos', 'Nombre: La Cantera', 'Localidad:', 'Desnivel: -', 'gracias'].join(
        '\n',
      ),
    );
    expect(campos).toEqual({ name: 'La Cantera' });
    // "Hola! te paso los datos" y "gracias" no tienen ":", no cuentan como campos
    expect(ignoradas).toEqual([]);
  });

  it('acepta el código de inserción pegado en el renglón del enlace', () => {
    const { campos } = parsearPlantilla(
      'Enlace: <iframe src="https://cdn.embedly.com/widgets/media.html?src=https://www.relive.com/view/vQvykNrjW46/widget?r=embed-site"></iframe>',
    );
    expect(campos.externalMapUrl).toBe(
      'https://www.relive.com/view/vQvykNrjW46/widget?r=embed-site',
    );
  });
});
