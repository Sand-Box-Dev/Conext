import React, { useCallback, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  MarkerType,
} from '@xyflow/react';
import type { Node, Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import { ConceptNodeComponent } from './ConceptNode';
import type { ConceptNodeData, ConceptEdgeData } from '../types';

interface ConceptMapProps {
  nodesData: ConceptNodeData[];
  edgesData: ConceptEdgeData[];
  selectedNodeId: number | null;
  onSelectNode: (nodeId: number) => void;
}

const nodeTypes = {
  conceptNode: ConceptNodeComponent,
};

const NODE_WIDTH = 220;
const NODE_HEIGHT = 110;

function getLayoutedElements(nodes: Node[], edges: Edge[]) {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  dagreGraph.setGraph({
    rankdir: 'TB', // Top to bottom flow
    nodesep: 40,
    ranksep: 70,
  });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - NODE_WIDTH / 2,
        y: nodeWithPosition.y - NODE_HEIGHT / 2,
      },
    };
  });

  return { layoutedNodes, layoutedEdges: edges };
}

export const ConceptMap: React.FC<ConceptMapProps> = ({
  nodesData,
  edgesData,
  selectedNodeId,
  onSelectNode,
}) => {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  useEffect(() => {
    if (!nodesData || nodesData.length === 0) {
      setNodes([]);
      setEdges([]);
      return;
    }

    const rawNodes: Node[] = nodesData.map((n) => ({
      id: String(n.id),
      type: 'conceptNode',
      data: n as unknown as Record<string, unknown>,
      selected: n.id === selectedNodeId,
      position: { x: 0, y: 0 },
    }));

    const rawEdges: Edge[] = edgesData.map((e) => ({
      id: `e-${e.id}`,
      source: String(e.source_node_id),
      target: String(e.target_node_id),
      label: e.relationship,
      animated: true,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: '#737373',
        width: 14,
        height: 14,
      },
      style: {
        stroke: '#525252',
        strokeWidth: 2,
      },
    }));

    const { layoutedNodes, layoutedEdges } = getLayoutedElements(rawNodes, rawEdges);
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
  }, [nodesData, edgesData, setNodes, setEdges]);

  // Selection only changes the node highlight. Keep the current positions so
  // clicking or dragging nodes never reruns Dagre and snaps the graph back.
  useEffect(() => {
    setNodes((currentNodes) => currentNodes.map((node) => ({
      ...node,
      selected: Number(node.id) === selectedNodeId,
    })));
  }, [selectedNodeId, setNodes]);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      onSelectNode(Number(node.id));
    },
    [onSelectNode]
  );

  return (
    <div className="w-full h-full relative bg-[#0b0f17]">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        nodesDraggable
        fitView
        fitViewOptions={{ padding: 0.12, minZoom: 0.45, maxZoom: 1.2 }}
        minZoom={0.2}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#1e293b" gap={20} size={1.2} />
        <Controls showInteractive={false} className="!left-4 !bottom-4 !m-0" />
      </ReactFlow>
    </div>
  );
};
