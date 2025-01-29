import { useEffect, useRef, useState } from 'react';
import { fabric } from 'fabric';
import { Button, Box, Stack, Paper, Typography, TextField } from '@mui/material';
import {
  Delete as DeleteIcon,
  Home as EntranceIcon,
  ExitToApp as ExitIcon,
  PersonPinCircle as LocationIcon
} from '@mui/icons-material';

// Canvas configuration
const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 800;
const GRID_SIZE = 20;
const WALL_THICKNESS = 8;
const PIXELS_PER_CM = 2;

type SpecialMarkerType = 'entrance' | 'exit' | 'location';

export default function App() {
  const canvasRef = useRef<fabric.Canvas | null>(null);
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [selectedObject, setSelectedObject] = useState<fabric.Object | null>(null);
  const [markers, setMarkers] = useState<Record<SpecialMarkerType, fabric.Object | null>>({
    entrance: null,
    exit: null,
    location: null
  });
  const [mapId, setMapId] = useState<string>('');

  // Initialize canvas and event handlers
  useEffect(() => {
    const initCanvas = () => {
      const canvas = new fabric.Canvas('canvas', {
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
        backgroundColor: '#fafafa',
        selection: true,
      });
      canvasRef.current = canvas;

      // Event handlers
      canvas.on('object:moving', handleObjectMoving);
      canvas.on('selection:created', handleSelection);
      canvas.on('selection:updated', handleSelection);
      canvas.on('selection:cleared', clearSelection);
      canvas.on('path:created', convertPathToWall);

      canvas.renderAll();
    };

    if (typeof window !== 'undefined') {
      initCanvas();
      window.addEventListener('keydown', handleKeyPress);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyPress);
      canvasRef.current?.dispose();
    };
  }, []);

  const handleKeyPress = (e: KeyboardEvent) => {
    if (e.key === 'Delete' && selectedObject) {
      deleteSelectedObject();
    }
  };

  const handleSelection = (e: fabric.IEvent) => {
    setSelectedObject(e.selected?.[0] || null);
  };

  const clearSelection = () => {
    setSelectedObject(null);
  };

  const handleObjectMoving = (e: fabric.IEvent) => {
    const obj = e.target;
    if (!obj) return;

    // Grid snapping
    obj.set({
      left: Math.round(obj.left! / GRID_SIZE) * GRID_SIZE,
      top: Math.round(obj.top! / GRID_SIZE) * GRID_SIZE
    });

    // Move products with shelf and keep them on top
    if (obj.data?.isShelf) {
      canvasRef.current?.getObjects().forEach(item => {
        if (item.data?.isProduct && item.data.parentShelf === obj) {
          item.set({
            left: obj.left! + item.data.relativeLeft!,
            top: obj.top! + item.data.relativeTop!
          });
          item.bringToFront();
        }
      });
    }
  };

  const convertPathToWall = (e: fabric.IEvent) => {
    const path = e.path;
    const canvas = canvasRef.current;
    if (!canvas || !path) return;

    const bbox = path.getBoundingRect();
    const isVertical = bbox.width < bbox.height;
    const length = Math.round((isVertical ? bbox.height : bbox.width) / PIXELS_PER_CM);

    const wall = new fabric.Rect({
      left: bbox.left,
      top: bbox.top,
      width: isVertical ? WALL_THICKNESS : bbox.width,
      height: isVertical ? bbox.height : WALL_THICKNESS,
      fill: '#757575',
      stroke: '#424242',
      strokeWidth: 1,
      selectable: true,
      data: { isWall: true }
    });

    const dimensionText = new fabric.Text(`${length}cm`, {
      fontSize: 14,
      fill: '#424242',
      left: wall.left! + (isVertical ? -30 : wall.width!/2),
      top: wall.top! + (isVertical ? wall.height!/2 : -20),
      angle: isVertical ? 90 : 0
    });

    const wallGroup = new fabric.Group([wall, dimensionText], {
      subTargetCheck: true,
      hasControls: true
    });

    wallGroup.on('scaling', () => {
      const updatedLength = Math.round(
        (isVertical ? wallGroup.height! : wallGroup.width!) / PIXELS_PER_CM
      );
      dimensionText.set('text', `${updatedLength}cm`);
      canvas.requestRenderAll();
    });

    canvas.remove(path);
    canvas.add(wallGroup);
    canvas.requestRenderAll();
  };

  const addSpecialMarker = (type: SpecialMarkerType) => {
    const canvas = canvasRef.current;
    if (!canvas || markers[type]) return;

    const marker = createMarker(type);
    canvas.add(marker);
    setMarkers(prev => ({ ...prev, [type]: marker }));
    canvas.renderAll();
  };

  const createMarker = (type: SpecialMarkerType): fabric.Object => {
    const baseProps = {
      selectable: true,
      hasControls: false,
      lockScaling: true,
      lockRotation: true,
      data: { markerType: type }
    };

    switch (type) {
      case 'entrance':
        return new fabric.Group([
          new fabric.Rect({ 
            width: 60, 
            height: 40, 
            fill: '#4caf50',
            rx: 5
          }),
          new fabric.Text('Entrance', { 
            fontSize: 14, 
            fill: 'white',
            left: 5,
            top: 12
          })
        ], { ...baseProps, left: 100, top: 100 });

      case 'exit':
        return new fabric.Group([
          new fabric.Rect({ 
            width: 60, 
            height: 40, 
            fill: '#f44336',
            rx: 5
          }),
          new fabric.Text('Exit', { 
            fontSize: 14, 
            fill: 'white',
            left: 15,
            top: 12
          })
        ], { ...baseProps, left: CANVAS_WIDTH - 100, top: 100 });

      case 'location':
        return new fabric.Group([
          new fabric.Circle({ radius: 20, fill: '#2196f3' }),
          new fabric.Text('📍', { fontSize: 24 })
        ], { ...baseProps, left: CANVAS_WIDTH/2, top: CANVAS_HEIGHT/2 });

      default:
        throw new Error('Invalid marker type');
    }
  };

  // Fixed Shelf Rotation
  const addShelf = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const shelf = new fabric.Rect({
      left: 100,
      top: 100,
      width: 200,
      height: 40,
      fill: '#bdbdbd',
      stroke: '#616161',
      strokeWidth: 1,
      hasControls: true,
      lockRotation: false, // Allow rotation
      originX: 'center',
      originY: 'center',
      data: { isShelf: true }
    });

    // Add rotation control handle
    shelf.controls.mtr = new fabric.Control({
      x: 0.5,
      y: -0.5,
      actionHandler: (fabric.controlsUtils as any).rotationWithSnapping,
      cursorStyle: 'crosshair',
      actionName: 'rotate'
    });

    canvas.add(shelf);
    canvas.renderAll();
  };

  // Fixed Product Addition
  const addProduct = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const product = new fabric.Textbox('Product', {
      width: 120,
      fontSize: 14,
      fill: '#2c3e50',
      textAlign: 'center',
      hasControls: true,
      lockRotation: true,
      data: { isProduct: true }
    });

    // Get current mouse position relative to canvas
    const pointer = canvas.getPointer(new MouseEvent('mousemove'));
    const shelf = canvas.getObjects().find(obj => {
      if (!obj.data?.isShelf || !pointer) return false;
      return obj.containsPoint(new fabric.Point(pointer.x, pointer.y));
    });

    if (shelf) {
      product.set({
        left: shelf.left! + 10,
        top: shelf.top! + 10,
        data: {
          ...product.data,
          relativeLeft: 10,
          relativeTop: 10,
          parentShelf: shelf
        }
      });
      canvas.add(product);
      product.bringToFront();
    } else {
      product.set({ left: 100, top: 100 });
      canvas.add(product);
    }

    canvas.renderAll();
  };

  const deleteSelectedObject = () => {
    if (!canvasRef.current || !selectedObject) return;
    
    canvasRef.current.remove(selectedObject);
    if (selectedObject.data?.markerType) {
      setMarkers(prev => ({ ...prev, [selectedObject.data.markerType]: null }));
    }
    setSelectedObject(null);
    canvasRef.current.renderAll();
  };

  const toggleDrawingMode = () => {
    if (!canvasRef.current) return;
    
    setIsDrawingMode(!isDrawingMode);
    canvasRef.current.isDrawingMode = !isDrawingMode;
    canvasRef.current.freeDrawingBrush.width = 4;
  };

  const saveMap = async () => {
    if (!canvasRef.current) return;
    
    try {
      const json = canvasRef.current.toJSON();
      const response = await fetch('http://localhost:8080/api/maps', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(json)
      });
      
      const savedId = await response.text();
      setMapId(savedId);
      alert(`Map saved successfully! ID: ${savedId}`);
    } catch (error) {
      alert('Failed to save map');
    }
  };
  
  const loadMap = async () => {
    if (!canvasRef.current) return;
    
    const loadId = prompt('Enter Map ID:');
    if (!loadId) return;

    try {
      const response = await fetch(`http://localhost:8080/api/maps/${loadId}`);
      if (!response.ok) throw new Error('Map not found');
      
      const data = await response.json();
      canvasRef.current.loadFromJSON(data, () => {
        canvasRef.current?.renderAll();
        initializeMarkers();
      });
      setMapId(loadId);
    } catch (error) {
      alert('Failed to load map');
    }
  };

  const initializeMarkers = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const markerObjects = canvas.getObjects().filter(obj => obj.data?.markerType);
    const newMarkers = { entrance: null, exit: null, location: null } as Record<SpecialMarkerType, fabric.Object | null>;
    
    markerObjects.forEach(obj => {
      const type = obj.data.markerType as SpecialMarkerType;
      newMarkers[type] = obj;
    });

    setMarkers(newMarkers);
  };

  return (
    <Box sx={{ p: 4 }}>
      <Stack direction="row" spacing={4}>
        <Paper sx={{ p: 2, width: 300 }}>
          <Typography variant="h6" gutterBottom>
            Market Map Editor
          </Typography>

          <Stack spacing={2}>
            <Typography variant="subtitle1">Current Map ID</Typography>
            <TextField
              value={mapId}
              label="Map ID"
              variant="outlined"
              size="small"
              InputProps={{ readOnly: true }}
            />

            <Typography variant="subtitle1">Special Markers</Typography>
            <Button 
              variant="outlined" 
              startIcon={<EntranceIcon />}
              onClick={() => addSpecialMarker('entrance')}
              disabled={!!markers.entrance}
            >
              Add Entrance
            </Button>
            
            <Button 
              variant="outlined" 
              startIcon={<ExitIcon />}
              onClick={() => addSpecialMarker('exit')}
              disabled={!!markers.exit}
            >
              Add Exit
            </Button>

            <Button 
              variant="outlined" 
              startIcon={<LocationIcon />}
              onClick={() => addSpecialMarker('location')}
              disabled={!!markers.location}
            >
              Add Location
            </Button>

            <Typography variant="subtitle1" sx={{ mt: 2 }}>Objects</Typography>
            <Button variant="contained" onClick={addShelf}>
              Add Shelf
            </Button>
            
            <Button variant="contained" onClick={addProduct}>
              Add Product
            </Button>

            <Button 
              variant="outlined" 
              onClick={toggleDrawingMode}
              color={isDrawingMode ? 'secondary' : 'primary'}
            >
              {isDrawingMode ? 'Stop Drawing Walls' : 'Draw Walls'}
            </Button>

            {selectedObject && (
              <Button 
                variant="outlined" 
                color="error"
                startIcon={<DeleteIcon />}
                onClick={deleteSelectedObject}
              >
                Delete Selected
              </Button>
            )}

            <Typography variant="subtitle1" sx={{ mt: 2 }}>Persistance</Typography>
            <Button variant="contained" color="success" onClick={saveMap}>
              Save Map
            </Button>
            <Button variant="outlined" color="info" onClick={loadMap}>
              Load Map
            </Button>
          </Stack>
        </Paper>

        <canvas 
          id="canvas"
          style={{
            border: '1px solid #bdbdbd',
            borderRadius: '4px',
            boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
          }}
        />
      </Stack>
    </Box>
  );
}