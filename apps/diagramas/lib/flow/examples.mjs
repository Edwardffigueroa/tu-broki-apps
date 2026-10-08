/**
 * Ejemplos del editor Carriles Pro.
 */

export const EXAMPLE_MINI = {
  "title": "Pedido mini",
  "lanes": [
    {
      "id": "cliente",
      "name": "Cliente"
    },
    {
      "id": "tubroki",
      "name": "TuBroki"
    },
    {
      "id": "sistema",
      "name": "Sistema"
    }
  ],
  "phases": [
    {
      "id": "p1",
      "name": "1 · Pedido",
      "width": 1000
    }
  ],
  "nodes": [
    {
      "id": "s1",
      "lane": "cliente",
      "type": "start",
      "label": "Quiere pedir",
      "col": 1,
      "slot": 1
    },
    {
      "id": "t1",
      "lane": "cliente",
      "type": "task",
      "label": "Escribe por WhatsApp",
      "col": 2,
      "slot": 1
    },
    {
      "id": "d1",
      "lane": "tubroki",
      "type": "decision",
      "label": "¿Toma el plan?",
      "col": 3,
      "slot": 1
    },
    {
      "id": "t2",
      "lane": "sistema",
      "type": "task",
      "label": "Crea la orden",
      "col": 4,
      "slot": 1
    },
    {
      "id": "e1",
      "lane": "cliente",
      "type": "end",
      "label": "Listo",
      "col": 5,
      "slot": 1
    },
    {
      "id": "e2",
      "lane": "cliente",
      "type": "end",
      "label": "No sigue",
      "col": 4,
      "slot": 2
    }
  ],
  "edges": [
    {
      "from": "s1",
      "to": "t1",
      "kind": "flow"
    },
    {
      "from": "t1",
      "to": "d1",
      "kind": "message"
    },
    {
      "from": "d1",
      "to": "t2",
      "label": "Sí",
      "kind": "flow"
    },
    {
      "from": "d1",
      "to": "e2",
      "label": "No",
      "kind": "flow"
    },
    {
      "from": "t2",
      "to": "e1",
      "kind": "flow"
    },
    {
      "from": "e2",
      "to": "t1",
      "label": "Reintentar",
      "kind": "return"
    }
  ],
  "docs": []
};

export const EXAMPLE_ARRIENDO = {
  "kind": "swimlane-flow",
  "version": 1,
  "title": "Arriendo de punta a punta — Todo para arrendar + Te Cuida",
  "lanes": [
    {
      "id": "propietario",
      "name": "Propietario",
      "color": "#E8F1FB",
      "height": 380
    },
    {
      "id": "interesado",
      "name": "Interesado / inquilino",
      "color": "#FFF4E5",
      "height": 260
    },
    {
      "id": "asesor",
      "name": "Asesor TuBroki",
      "color": "#EAF7EE",
      "height": 380
    },
    {
      "id": "plataforma",
      "name": "Plataforma TuBroki (app)",
      "color": "#F1ECFB",
      "height": 260
    },
    {
      "id": "portales",
      "name": "Portales (Finca Raíz · MetroCuadrado)",
      "color": "#F4F4F5",
      "height": 140
    },
    {
      "id": "wompi",
      "name": "Wompi (pagos)",
      "color": "#E9F6F8",
      "height": 140
    },
    {
      "id": "zapsign",
      "name": "ZapSign (firma y estudios)",
      "color": "#FCEFF3",
      "height": 260
    },
    {
      "id": "sura",
      "name": "SURA vía Figuro (póliza)",
      "color": "#EEF2E3",
      "height": 140
    }
  ],
  "phases": [
    {
      "id": "captacion",
      "name": "1 · Captación y pago",
      "width": 1800
    },
    {
      "id": "publicacion",
      "name": "2 · Publicación",
      "width": 1000
    },
    {
      "id": "interesados",
      "name": "3 · Interesados y visitas",
      "width": 1200
    },
    {
      "id": "validacion",
      "name": "4 · Validación",
      "width": 1200
    },
    {
      "id": "contrato",
      "name": "5 · Contrato y firma",
      "width": 1600
    },
    {
      "id": "entrega",
      "name": "6 · Entrega",
      "width": 800
    },
    {
      "id": "tecuida",
      "name": "7 · TuBroki Te Cuida",
      "width": 1800
    }
  ],
  "nodes": [
    {
      "id": "p1",
      "lane": "propietario",
      "type": "start",
      "label": "Quiere arrendar su inmueble",
      "col": 1,
      "slot": 1
    },
    {
      "id": "p2",
      "lane": "propietario",
      "type": "task",
      "label": "Escribe a TuBroki por WhatsApp",
      "col": 2,
      "slot": 1,
      "meta": {
        "system": "WhatsApp"
      }
    },
    {
      "id": "a1",
      "lane": "asesor",
      "type": "task",
      "label": "Llamada inicial: precio, tiempos y documentos",
      "col": 3,
      "slot": 1,
      "meta": {
        "owner": "Asesor",
        "sla": "Mismo día"
      }
    },
    {
      "id": "a2",
      "lane": "asesor",
      "type": "decision",
      "label": "¿Toma Todo para arrendar?",
      "col": 4,
      "slot": 1
    },
    {
      "id": "p3",
      "lane": "propietario",
      "type": "end",
      "label": "Sigue con Publica gratis",
      "col": 5,
      "slot": 3
    },
    {
      "id": "pl1",
      "lane": "plataforma",
      "type": "task",
      "label": "Crea la orden por $629.000 COP",
      "col": 5,
      "slot": 1,
      "meta": {
        "system": "tu-broki-app"
      }
    },
    {
      "id": "w1",
      "lane": "wompi",
      "type": "event",
      "event": "message",
      "label": "Genera link de pago",
      "col": 6,
      "slot": 1
    },
    {
      "id": "p4",
      "lane": "propietario",
      "type": "task",
      "label": "Paga $629.000 COP",
      "col": 7,
      "slot": 1
    },
    {
      "id": "w2",
      "lane": "wompi",
      "type": "decision",
      "label": "¿Pago aprobado?",
      "col": 8,
      "slot": 1
    },
    {
      "id": "pl2",
      "lane": "plataforma",
      "type": "task",
      "label": "Activa el caso y el checklist",
      "col": 9,
      "slot": 1,
      "meta": {
        "status": "ok"
      }
    },
    {
      "id": "a3",
      "lane": "asesor",
      "type": "task",
      "label": "Envía la guía fotográfica",
      "col": 10,
      "slot": 1
    },
    {
      "id": "p5",
      "lane": "propietario",
      "type": "task",
      "label": "Toma fotos y video",
      "col": 11,
      "slot": 1
    },
    {
      "id": "a4",
      "lane": "asesor",
      "type": "decision",
      "label": "¿Fotos aprobadas?",
      "col": 12,
      "slot": 1
    },
    {
      "id": "a5",
      "lane": "asesor",
      "type": "task",
      "label": "Arma el anuncio estructurado",
      "col": 13,
      "slot": 1
    },
    {
      "id": "pl3",
      "lane": "plataforma",
      "type": "data",
      "label": "Ficha del inmueble y precio sugerido",
      "col": 13,
      "slot": 1
    },
    {
      "id": "po1",
      "lane": "portales",
      "type": "task",
      "label": "Publica 4 meses en portales premium",
      "col": 14,
      "slot": 1
    },
    {
      "id": "pl4",
      "lane": "plataforma",
      "type": "task",
      "label": "Publica en TuBroki",
      "col": 14,
      "slot": 2
    },
    {
      "id": "i1",
      "lane": "interesado",
      "type": "event",
      "event": "message",
      "label": "Ve el anuncio y escribe",
      "col": 15,
      "slot": 1
    },
    {
      "id": "a6",
      "lane": "asesor",
      "type": "task",
      "label": "Filtra al interesado",
      "col": 16,
      "slot": 1,
      "note": "Preguntas clave: ingresos, mascotas, fecha de entrada y número de personas."
    },
    {
      "id": "a7",
      "lane": "asesor",
      "type": "decision",
      "label": "¿Cumple el perfil?",
      "col": 17,
      "slot": 1
    },
    {
      "id": "i2",
      "lane": "interesado",
      "type": "end",
      "label": "Recibe respuesta y cierre",
      "col": 18,
      "slot": 2
    },
    {
      "id": "a8",
      "lane": "asesor",
      "type": "task",
      "label": "Coordina la visita en un solo canal",
      "col": 18,
      "slot": 1
    },
    {
      "id": "p6",
      "lane": "propietario",
      "type": "task",
      "label": "Muestra el inmueble",
      "col": 19,
      "slot": 1,
      "note": "El propietario hace las visitas; TuBroki coordina agenda y recordatorios."
    },
    {
      "id": "i3",
      "lane": "interesado",
      "type": "task",
      "label": "Visita el inmueble",
      "col": 19,
      "slot": 1
    },
    {
      "id": "i4",
      "lane": "interesado",
      "type": "decision",
      "label": "¿Quiere arrendarlo?",
      "col": 20,
      "slot": 1
    },
    {
      "id": "a9",
      "lane": "asesor",
      "type": "task",
      "label": "Pide autorización del estudio",
      "col": 21,
      "slot": 1
    },
    {
      "id": "i5",
      "lane": "interesado",
      "type": "task",
      "label": "Firma la autorización",
      "col": 22,
      "slot": 1
    },
    {
      "id": "z1",
      "lane": "zapsign",
      "type": "event",
      "event": "message",
      "label": "Recibe autorización firmada",
      "col": 23,
      "slot": 1
    },
    {
      "id": "z2",
      "lane": "zapsign",
      "type": "subprocess",
      "label": "Validación de antecedentes ($39.000 COP)",
      "col": 24,
      "slot": 1,
      "note": "Identidad, listas restrictivas (OFAC, Interpol), antecedentes penales y procesos judiciales.",
      "meta": {
        "sla": "24 h"
      }
    },
    {
      "id": "pl5",
      "lane": "plataforma",
      "type": "document",
      "label": "Reporte de Confianza (1–10)",
      "col": 25,
      "slot": 1
    },
    {
      "id": "t1",
      "lane": "plataforma",
      "type": "event",
      "event": "timer",
      "label": "24 h sin reporte",
      "col": 25,
      "slot": 2
    },
    {
      "id": "a10",
      "lane": "asesor",
      "type": "task",
      "label": "Escala con el proveedor",
      "col": 26,
      "slot": 3,
      "meta": {
        "status": "riesgo"
      }
    },
    {
      "id": "p7",
      "lane": "propietario",
      "type": "decision",
      "label": "¿Aprueba al inquilino?",
      "col": 26,
      "slot": 1
    },
    {
      "id": "a11",
      "lane": "asesor",
      "type": "document",
      "label": "Contrato personalizado (borrador)",
      "col": 27,
      "slot": 1
    },
    {
      "id": "p8",
      "lane": "propietario",
      "type": "decision",
      "label": "¿Pide ajustes?",
      "col": 28,
      "slot": 1
    },
    {
      "id": "a12",
      "lane": "asesor",
      "type": "task",
      "label": "Aplica el ajuste",
      "col": 29,
      "slot": 2
    },
    {
      "id": "n1",
      "lane": "asesor",
      "type": "annotation",
      "label": "Incluye 2 ajustes",
      "col": 29,
      "slot": 3
    },
    {
      "id": "z3",
      "lane": "zapsign",
      "type": "task",
      "label": "Envía a firma digital",
      "col": 30,
      "slot": 1
    },
    {
      "id": "p9",
      "lane": "propietario",
      "type": "task",
      "label": "Firma el contrato",
      "col": 31,
      "slot": 1
    },
    {
      "id": "i6",
      "lane": "interesado",
      "type": "task",
      "label": "Firma el contrato",
      "col": 31,
      "slot": 1
    },
    {
      "id": "z4",
      "lane": "zapsign",
      "type": "decision",
      "label": "¿Firmaron ambos?",
      "col": 32,
      "slot": 1
    },
    {
      "id": "t2",
      "lane": "zapsign",
      "type": "event",
      "event": "timer",
      "label": "Recordatorio a las 48 h",
      "col": 32,
      "slot": 2
    },
    {
      "id": "z5",
      "lane": "zapsign",
      "type": "document",
      "label": "PDF firmado",
      "col": 33,
      "slot": 1
    },
    {
      "id": "pl6",
      "lane": "plataforma",
      "type": "task",
      "label": "Guarda el contrato y avisa a ambos",
      "col": 34,
      "slot": 1
    },
    {
      "id": "a13",
      "lane": "asesor",
      "type": "task",
      "label": "Programa la entrega",
      "col": 35,
      "slot": 1
    },
    {
      "id": "a14",
      "lane": "asesor",
      "type": "document",
      "label": "Inventario y acta de entrega",
      "col": 36,
      "slot": 1
    },
    {
      "id": "p10",
      "lane": "propietario",
      "type": "task",
      "label": "Entrega las llaves",
      "col": 37,
      "slot": 1
    },
    {
      "id": "i7",
      "lane": "interesado",
      "type": "task",
      "label": "Recibe el inmueble",
      "col": 37,
      "slot": 1
    },
    {
      "id": "p11",
      "lane": "propietario",
      "type": "decision",
      "label": "¿Quiere TuBroki Te Cuida?",
      "col": 38,
      "slot": 1
    },
    {
      "id": "p12",
      "lane": "propietario",
      "type": "end",
      "label": "Arrienda por su cuenta, sin comisión mensual",
      "col": 39,
      "slot": 3
    },
    {
      "id": "s1",
      "lane": "sura",
      "type": "task",
      "label": "Cotiza la póliza de arrendamiento",
      "col": 39,
      "slot": 1
    },
    {
      "id": "s2",
      "lane": "sura",
      "type": "document",
      "label": "Póliza emitida (se paga a SURA)",
      "col": 40,
      "slot": 1
    },
    {
      "id": "pl7",
      "lane": "plataforma",
      "type": "task",
      "label": "Activa Te Cuida: $59.000/mes",
      "col": 41,
      "slot": 1
    },
    {
      "id": "w3",
      "lane": "wompi",
      "type": "event",
      "event": "timer",
      "label": "Cobro mensual $59.000",
      "col": 42,
      "slot": 1
    },
    {
      "id": "pl8",
      "lane": "plataforma",
      "type": "event",
      "event": "timer",
      "label": "Llega la fecha del canon",
      "col": 43,
      "slot": 1
    },
    {
      "id": "i8",
      "lane": "interesado",
      "type": "task",
      "label": "Paga el canon",
      "col": 44,
      "slot": 1
    },
    {
      "id": "pl9",
      "lane": "plataforma",
      "type": "decision",
      "label": "¿Canon al día?",
      "col": 45,
      "slot": 1
    },
    {
      "id": "s3",
      "lane": "sura",
      "type": "task",
      "label": "Gestiona la mora con la póliza",
      "col": 46,
      "slot": 1,
      "meta": {
        "status": "riesgo"
      }
    },
    {
      "id": "p13",
      "lane": "propietario",
      "type": "end",
      "label": "Recibe su canon",
      "col": 47,
      "slot": 1
    }
  ],
  "edges": [
    {
      "id": "e1",
      "from": "p1",
      "to": "p2",
      "kind": "flow"
    },
    {
      "id": "e2",
      "from": "p2",
      "to": "a1",
      "kind": "message"
    },
    {
      "id": "e3",
      "from": "a1",
      "to": "a2",
      "kind": "flow"
    },
    {
      "id": "e4",
      "from": "a2",
      "to": "p3",
      "kind": "message",
      "label": "No"
    },
    {
      "id": "e5",
      "from": "a2",
      "to": "pl1",
      "kind": "flow",
      "label": "Sí"
    },
    {
      "id": "e6",
      "from": "pl1",
      "to": "w1",
      "kind": "flow"
    },
    {
      "id": "e7",
      "from": "w1",
      "to": "p4",
      "kind": "message",
      "label": "Link"
    },
    {
      "id": "e8",
      "from": "p4",
      "to": "w2",
      "kind": "flow"
    },
    {
      "id": "e9",
      "from": "w2",
      "to": "p4",
      "kind": "return",
      "label": "Rechazado",
      "fromHandle": "top",
      "toHandle": "bottom"
    },
    {
      "id": "e10",
      "from": "w2",
      "to": "pl2",
      "kind": "flow",
      "label": "Aprobado"
    },
    {
      "id": "e11",
      "from": "pl2",
      "to": "a3",
      "kind": "flow"
    },
    {
      "id": "e12",
      "from": "a3",
      "to": "p5",
      "kind": "message"
    },
    {
      "id": "e13",
      "from": "p5",
      "to": "a4",
      "kind": "message"
    },
    {
      "id": "e14",
      "from": "a4",
      "to": "p5",
      "kind": "return",
      "label": "Repetir fotos",
      "fromHandle": "top",
      "toHandle": "bottom"
    },
    {
      "id": "e15",
      "from": "a4",
      "to": "a5",
      "kind": "flow",
      "label": "Sí"
    },
    {
      "id": "e16",
      "from": "a5",
      "to": "pl3",
      "kind": "async",
      "label": "Guarda"
    },
    {
      "id": "e17",
      "from": "a5",
      "to": "po1",
      "kind": "flow"
    },
    {
      "id": "e18",
      "from": "a5",
      "to": "pl4",
      "kind": "flow"
    },
    {
      "id": "e19",
      "from": "po1",
      "to": "i1",
      "kind": "message",
      "label": "Anuncio"
    },
    {
      "id": "e20",
      "from": "pl4",
      "to": "i1",
      "kind": "message"
    },
    {
      "id": "e21",
      "from": "i1",
      "to": "a6",
      "kind": "message"
    },
    {
      "id": "e22",
      "from": "a6",
      "to": "a7",
      "kind": "flow"
    },
    {
      "id": "e23",
      "from": "a7",
      "to": "i2",
      "kind": "message",
      "label": "No"
    },
    {
      "id": "e24",
      "from": "a7",
      "to": "a8",
      "kind": "flow",
      "label": "Sí"
    },
    {
      "id": "e25",
      "from": "a8",
      "to": "p6",
      "kind": "message",
      "label": "Agenda"
    },
    {
      "id": "e26",
      "from": "a8",
      "to": "i3",
      "kind": "message",
      "label": "Agenda"
    },
    {
      "id": "e27",
      "from": "i3",
      "to": "i4",
      "kind": "flow"
    },
    {
      "id": "e28",
      "from": "i4",
      "to": "a6",
      "kind": "return",
      "label": "Siguiente interesado",
      "fromHandle": "bottom",
      "toHandle": "bottom"
    },
    {
      "id": "e29",
      "from": "i4",
      "to": "a9",
      "kind": "message",
      "label": "Sí"
    },
    {
      "id": "e30",
      "from": "a9",
      "to": "i5",
      "kind": "message"
    },
    {
      "id": "e31",
      "from": "i5",
      "to": "z1",
      "kind": "flow"
    },
    {
      "id": "e32",
      "from": "z1",
      "to": "z2",
      "kind": "flow"
    },
    {
      "id": "e33",
      "from": "z2",
      "to": "pl5",
      "kind": "flow"
    },
    {
      "id": "e34",
      "from": "z2",
      "to": "t1",
      "kind": "async",
      "label": "24 h"
    },
    {
      "id": "e35",
      "from": "t1",
      "to": "a10",
      "kind": "message"
    },
    {
      "id": "e36",
      "from": "a10",
      "to": "z2",
      "kind": "return",
      "label": "Reintenta",
      "fromHandle": "bottom",
      "toHandle": "bottom"
    },
    {
      "id": "e37",
      "from": "pl5",
      "to": "p7",
      "kind": "message"
    },
    {
      "id": "e38",
      "from": "p7",
      "to": "a6",
      "kind": "return",
      "label": "Buscar otro interesado",
      "fromHandle": "top",
      "toHandle": "top"
    },
    {
      "id": "e39",
      "from": "p7",
      "to": "a11",
      "kind": "message",
      "label": "Sí"
    },
    {
      "id": "e40",
      "from": "a11",
      "to": "p8",
      "kind": "message"
    },
    {
      "id": "e41",
      "from": "p8",
      "to": "a12",
      "kind": "message",
      "label": "Sí"
    },
    {
      "id": "e42",
      "from": "a12",
      "to": "a11",
      "kind": "return",
      "label": "Nueva versión",
      "fromHandle": "left",
      "toHandle": "bottom"
    },
    {
      "id": "e43",
      "from": "p8",
      "to": "z3",
      "kind": "flow",
      "label": "No"
    },
    {
      "id": "e44",
      "from": "z3",
      "to": "p9",
      "kind": "message"
    },
    {
      "id": "e45",
      "from": "z3",
      "to": "i6",
      "kind": "message"
    },
    {
      "id": "e46",
      "from": "p9",
      "to": "z4",
      "kind": "flow"
    },
    {
      "id": "e47",
      "from": "i6",
      "to": "z4",
      "kind": "flow"
    },
    {
      "id": "e48",
      "from": "z4",
      "to": "t2",
      "kind": "flow",
      "label": "No"
    },
    {
      "id": "e49",
      "from": "t2",
      "to": "z3",
      "kind": "return",
      "fromHandle": "left",
      "toHandle": "bottom"
    },
    {
      "id": "e50",
      "from": "z4",
      "to": "z5",
      "kind": "flow",
      "label": "Sí"
    },
    {
      "id": "e51",
      "from": "z5",
      "to": "pl6",
      "kind": "flow"
    },
    {
      "id": "e52",
      "from": "pl6",
      "to": "a13",
      "kind": "async",
      "label": "Aviso"
    },
    {
      "id": "e53",
      "from": "a13",
      "to": "a14",
      "kind": "flow"
    },
    {
      "id": "e54",
      "from": "a14",
      "to": "p10",
      "kind": "message"
    },
    {
      "id": "e55",
      "from": "a14",
      "to": "i7",
      "kind": "message"
    },
    {
      "id": "e56",
      "from": "p10",
      "to": "p11",
      "kind": "flow"
    },
    {
      "id": "e57",
      "from": "i7",
      "to": "p11",
      "kind": "message",
      "label": "Acta firmada"
    },
    {
      "id": "e58",
      "from": "p11",
      "to": "p12",
      "kind": "flow",
      "label": "No"
    },
    {
      "id": "e59",
      "from": "p11",
      "to": "s1",
      "kind": "message",
      "label": "Sí"
    },
    {
      "id": "e60",
      "from": "s1",
      "to": "s2",
      "kind": "flow"
    },
    {
      "id": "e61",
      "from": "s2",
      "to": "pl7",
      "kind": "message"
    },
    {
      "id": "e62",
      "from": "pl7",
      "to": "w3",
      "kind": "async",
      "label": "Suscripción"
    },
    {
      "id": "e63",
      "from": "pl7",
      "to": "pl8",
      "kind": "flow"
    },
    {
      "id": "e64",
      "from": "pl8",
      "to": "i8",
      "kind": "message",
      "label": "Aviso de pago"
    },
    {
      "id": "e65",
      "from": "i8",
      "to": "pl9",
      "kind": "message"
    },
    {
      "id": "e66",
      "from": "pl9",
      "to": "p13",
      "kind": "message",
      "label": "Sí"
    },
    {
      "id": "e67",
      "from": "pl9",
      "to": "s3",
      "kind": "message",
      "label": "No"
    },
    {
      "id": "e68",
      "from": "s3",
      "to": "p13",
      "kind": "message"
    },
    {
      "id": "e69",
      "from": "pl9",
      "to": "pl8",
      "kind": "return",
      "label": "Mes siguiente",
      "fromHandle": "bottom",
      "toHandle": "bottom"
    },
    {
      "id": "e70",
      "from": "n1",
      "to": "a12",
      "kind": "association"
    },
    {
      "id": "e71",
      "from": "w3",
      "to": "pl8",
      "kind": "async"
    },
    {
      "id": "e72",
      "from": "p6",
      "to": "i3",
      "kind": "message",
      "label": "Recorrido"
    }
  ],
  "docs": [
    {
      "id": "lectura",
      "title": "Cómo leer este flujo",
      "body": "Cada **carril** es un actor. Cada **fase** (arriba) agrupa columnas del proceso.\n\n| Línea | Significa |\n|---|---|\n| Sólida | Siguiente paso del mismo proceso |\n| Discontinua con círculo | Mensaje entre actores (WhatsApp, correo, notificación) |\n| Discontinua cálida | Reproceso: vuelve a un paso anterior |\n| Punteada | Disparo asíncrono (registro, cobro programado) |\n| Punteada sin flecha | Nota que explica un paso |\n\nEl propietario hace las visitas. TuBroki coordina, filtra y acompaña: **tú decides, pero no estás solo**."
    },
    {
      "id": "precios",
      "title": "Precios y reglas que aparecen",
      "body": "- Todo para arrendar: **$629.000 COP**, pago único. Incluye contrato personalizado, firma digital, 2 ajustes, inventario y actas.\n- Validación de antecedentes: **$39.000 COP** por estudio. Requiere autorización firmada.\n- TuBroki Te Cuida: **$59.000/mes** + póliza de arrendamiento que se paga directo a SURA.\n- Sin comisiones porcentuales y sin exclusividad."
    },
    {
      "id": "estados",
      "title": "Estados del caso",
      "body": "```mermaid\nstateDiagram-v2\n  [*] --> Pagado\n  Pagado --> Publicado\n  Publicado --> EnVisitas\n  EnVisitas --> EnValidacion\n  EnValidacion --> EnVisitas: rechazado\n  EnValidacion --> EnContrato\n  EnContrato --> Firmado\n  Firmado --> Entregado\n  Entregado --> TeCuida: acepta\n  Entregado --> [*]: no acepta\n  TeCuida --> [*]\n```"
    }
  ]
};
