import type { DiagramModel } from './schema'

export const EXAMPLES: Record<string, DiagramModel> = {
  pedido: {
    title: 'Pedido en línea',
    lanes: [
      { id: 'cliente', name: 'Cliente' },
      { id: 'ventas', name: 'Ventas' },
      { id: 'bodega', name: 'Bodega' },
      { id: 'pagos', name: 'Pagos' },
    ],
    nodes: [
      { id: 'n1', lane: 'cliente', type: 'start', label: 'Hace un pedido' },
      { id: 'n2', lane: 'ventas', type: 'task', label: 'Revisar el pedido' },
      { id: 'n3', lane: 'ventas', type: 'decision', label: '¿Hay stock?' },
      { id: 'n4', lane: 'pagos', type: 'task', label: 'Cobrar al cliente' },
      {
        id: 'n5',
        lane: 'bodega',
        type: 'task',
        label: 'Preparar el paquete',
        note: 'Verificar referencia y cantidades antes de empacar.',
      },
      { id: 'n6', lane: 'bodega', type: 'task', label: 'Despachar' },
      { id: 'n7', lane: 'cliente', type: 'end', label: 'Recibe su pedido' },
      { id: 'n8', lane: 'ventas', type: 'task', label: 'Avisar que no hay stock' },
      { id: 'n9', lane: 'cliente', type: 'end', label: 'Pedido cancelado' },
    ],
    edges: [
      { from: 'n1', to: 'n2' },
      { from: 'n2', to: 'n3' },
      { from: 'n3', to: 'n4', label: 'Sí' },
      { from: 'n3', to: 'n8', label: 'No' },
      { from: 'n4', to: 'n5' },
      { from: 'n5', to: 'n6' },
      { from: 'n6', to: 'n7' },
      { from: 'n8', to: 'n9' },
    ],
  },
  gastos: {
    title: 'Aprobación de gastos',
    lanes: [
      { id: 'empleado', name: 'Empleado' },
      { id: 'jefe', name: 'Jefe directo' },
      { id: 'finanzas', name: 'Finanzas' },
    ],
    nodes: [
      { id: 'e1', lane: 'empleado', type: 'start', label: 'Necesita un gasto' },
      { id: 'e2', lane: 'empleado', type: 'document', label: 'Formulario de gasto' },
      { id: 'e3', lane: 'jefe', type: 'decision', label: '¿Lo aprueba?' },
      { id: 'e4', lane: 'empleado', type: 'task', label: 'Corregir la solicitud' },
      { id: 'e5', lane: 'finanzas', type: 'task', label: 'Registrar y pagar' },
      { id: 'e6', lane: 'empleado', type: 'end', label: 'Gasto reembolsado' },
    ],
    edges: [
      { from: 'e1', to: 'e2' },
      { from: 'e2', to: 'e3' },
      { from: 'e3', to: 'e5', label: 'Sí' },
      { from: 'e3', to: 'e4', label: 'No' },
      { from: 'e4', to: 'e2', label: 'Reenviar' },
      { from: 'e5', to: 'e6' },
    ],
  },
  arriendo: {
    title: 'Arriendo con TuBroki (PACK 3)',
    lanes: [
      { id: 'propietario', name: 'Propietario' },
      { id: 'tubroki', name: 'TuBroki' },
      { id: 'interesado', name: 'Interesado' },
      { id: 'aseguradora', name: 'Aseguradora' },
    ],
    nodes: [
      { id: 'p1', lane: 'propietario', type: 'start', label: 'Quiere arrendar' },
      {
        id: 'p2',
        lane: 'propietario',
        type: 'task',
        label: 'Elige su PACK',
        note: 'PACK 1 $249.000 · PACK 2 $349.000 · PACK 3 $449.000 COP. Pago único, sin comisión mensual.',
      },
      {
        id: 't1',
        lane: 'tubroki',
        type: 'task',
        label: 'Publica en portales',
        note: 'Finca Raíz, Metrocuadrado y Proppit por 4 meses + canales digitales.',
      },
      { id: 'i1', lane: 'interesado', type: 'task', label: 'Escribe por WhatsApp' },
      { id: 't2', lane: 'tubroki', type: 'task', label: 'Filtra interesados' },
      { id: 't3', lane: 'tubroki', type: 'task', label: 'Agenda visita' },
      { id: 'p3', lane: 'propietario', type: 'task', label: 'Hace la visita' },
      { id: 'd1', lane: 'interesado', type: 'decision', label: '¿Le interesa?' },
      { id: 'i2', lane: 'interesado', type: 'document', label: 'Entrega documentos' },
      {
        id: 't4',
        lane: 'tubroki',
        type: 'task',
        label: 'Estudio de inquilino',
        note: 'Antecedentes + crédito con Trucheck. Combo ~$55.000 COP.',
      },
      { id: 'd2', lane: 'tubroki', type: 'decision', label: '¿Aprobado?' },
      {
        id: 'a1',
        lane: 'aseguradora',
        type: 'task',
        label: 'Expide la póliza',
        note: 'SURA, SBS o Mundial. Valor según la aseguradora que elija el cliente.',
      },
      { id: 't5', lane: 'tubroki', type: 'document', label: 'Contrato + firma digital' },
      { id: 'd3', lane: 'propietario', type: 'decision', label: '¿Firma?' },
      { id: 't6', lane: 'tubroki', type: 'task', label: 'Ajusta el contrato' },
      { id: 'p4', lane: 'propietario', type: 'end', label: 'Inmueble arrendado' },
      { id: 'i3', lane: 'interesado', type: 'end', label: 'No continúa' },
    ],
    edges: [
      { from: 'p1', to: 'p2' },
      { from: 'p2', to: 't1' },
      { from: 't1', to: 'i1' },
      { from: 'i1', to: 't2' },
      { from: 't2', to: 't3' },
      { from: 't3', to: 'p3' },
      { from: 'p3', to: 'd1' },
      { from: 'd1', to: 'i2', label: 'Sí' },
      { from: 'd1', to: 't2', label: 'No, siguiente', fromPort: 'bottom', toPort: 'bottom' },
      { from: 'i2', to: 't4' },
      { from: 't4', to: 'd2' },
      { from: 'd2', to: 'a1', label: 'Sí' },
      { from: 'd2', to: 'i3', label: 'No' },
      { from: 'd2', to: 't2', label: 'Buscar otro', fromPort: 'top', toPort: 'top' },
      { from: 'a1', to: 't5' },
      { from: 't5', to: 'd3' },
      { from: 'd3', to: 'p4', label: 'Sí' },
      { from: 'd3', to: 't6', label: 'Cambios' },
      { from: 't6', to: 't5', label: 'Reenviar', fromPort: 'bottom', toPort: 'bottom' },
    ],
    docs: [
      {
        id: 'lectura',
        title: 'Cómo leer este flujo',
        body:
          'Este diagrama muestra el **PACK 3 — Todo para Arrendar** ($449.000 COP, pago único).\n\n' +
          '- El propietario **mantiene el control**: hace las visitas y firma.\n' +
          '- TuBroki publica, filtra, agenda, estudia y arma el contrato.\n' +
          '- Si un interesado no sigue, **volvemos a filtrar** (no es lineal).\n' +
          '- El seguro lo expide la aseguradora (SURA, SBS o Mundial).\n\n' +
          '> Sin comisión mensual. Sin exclusividad. Tú decides.',
      },
      {
        id: 'retornos',
        title: 'Mapa de retornos',
        body:
          'Los tres bucles del proceso:\n\n' +
          '```mermaid\n' +
          'flowchart TD\n' +
          '  filtro[Filtra interesados] --> visita[Agenda y visita]\n' +
          '  visita --> interesa{¿Le interesa?}\n' +
          '  interesa -->|Sí| docs[Entrega documentos]\n' +
          '  interesa -->|No| filtro\n' +
          '  docs --> estudio[Estudio de inquilino]\n' +
          '  estudio --> aprobado{¿Aprobado?}\n' +
          '  aprobado -->|Sí| poliza[Póliza + contrato]\n' +
          '  aprobado -->|No| finNo[No continúa]\n' +
          '  aprobado -->|Buscar otro| filtro\n' +
          '  poliza --> firma{¿Firma?}\n' +
          '  firma -->|Sí| finOk[Inmueble arrendado]\n' +
          '  firma -->|Cambios| ajusta[Ajusta contrato]\n' +
          '  ajusta --> poliza\n' +
          '```\n',
      },
    ],
  },
  vacio: {
    title: 'Nuevo diagrama',
    lanes: [
      { id: 'carril-1', name: 'Carril 1' },
      { id: 'carril-2', name: 'Carril 2' },
    ],
    nodes: [{ id: 'n1', lane: 'carril-1', type: 'start', label: 'Inicio' }],
    edges: [],
  },
}
