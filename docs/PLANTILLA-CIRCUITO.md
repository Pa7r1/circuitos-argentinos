# Planilla para sumar un circuito

Este es el mensaje que se le manda a quien conoce el lugar. Se copia tal cual y se
envía por WhatsApp. La persona contesta llenando los renglones, o manda un audio y
se transcribe: da lo mismo, lo que importa es que cada dato quede en su renglón con
el `:` adelante.

Después, en `/admin` → **Nuevo circuito** → **Pegar datos**, se pega la respuesta
entera y el formulario se completa solo. Nada se guarda sin revisarlo.

## El mensaje

```
¡Hola! Estoy armando un mapa de circuitos off-road de Argentina y me
gustaría sumar el tuyo. Contestame estos datos (lo que no sepas, dejalo
vacío) o mandame un audio y yo lo cargo:

Nombre:
Disciplina:
Provincia:
Localidad:
Dificultad:
Acceso:
Notas de acceso:
Distancia:
Desnivel:
Enlace:
Descripción:
```

## Qué se puede escribir en cada renglón

| Renglón             | Qué va                                                                                      |
| ------------------- | ------------------------------------------------------------------------------------------- |
| **Nombre**          | Cómo le dicen al circuito. Es el único obligatorio.                                         |
| **Disciplina**      | Enduro, Motocross o MTB                                                                     |
| **Provincia**       | El nombre completo: La Rioja, Córdoba, Buenos Aires…                                        |
| **Localidad**       | El pueblo o la ciudad más cercana                                                           |
| **Dificultad**      | Fácil, Intermedio, Difícil o Extremo (también valen principiante, medio, avanzado, experto) |
| **Acceso**          | Libre, Con permiso o Pago (también valen abierto, gratis, privado, arancelado)              |
| **Notas de acceso** | A quién hay que avisar, si hay tranquera, cuánto sale                                       |
| **Distancia**       | En kilómetros. Se puede escribir "12,5 km", el "km" se ignora                               |
| **Desnivel**        | En metros                                                                                   |
| **Enlace**          | La dirección de Relive, Strava, Wikiloc, Komoot o Google My Maps                            |
| **Descripción**     | Cómo es andar ahí: el terreno, qué tener en cuenta                                          |

Detalles que evitan idas y vueltas:

- **El enlace se pega como venga.** Sirve la dirección que comparte la app —incluida
  la que trae el idioma adelante, tipo `relive.com/es/view/…`— y también el código de
  inserción entero, el que copiás del botón "Incorporar".
- **El punto en el mapa no sale del texto**: dónde arranca el circuito se marca a mano
  en `/admin`, haciendo clic sobre el mapa. Es el único dato que no se puede pegar.
- Renglones vacíos o con un guion se saltean. Un renglón que no se entienda no rompe
  nada: se avisa cuáles quedaron afuera y se cargan a mano.
- Si te pasan el GPX, mejor todavía: subilo y la distancia y el desnivel salen solos.

## Ejemplo de respuesta

```
Nombre: Quebrada del Cóndor
Disciplina: Enduro
Provincia: La Rioja
Localidad: Chilecito
Dificultad: Intermedio
Acceso: Libre
Notas de acceso: Se entra por la ruta 40, tranquera abierta todo el año
Distancia: 12,5 km
Desnivel: 340
Enlace: https://www.relive.com/es/view/vQvykNrjW46
Descripción: Arena floja los primeros kilómetros y después piedra suelta.
```
