import { useCallback, useEffect, useRef, useState } from 'react';
import { fabric } from 'fabric';
import { Button, Box, Stack, Paper, Typography, TextField } from '@mui/material';
import {
  Delete as DeleteIcon,
  Home as EntranceIcon,
  ExitToApp as ExitIcon,
  PersonPinCircle as LocationIcon
} from '@mui/icons-material';

// Canvas konfigürasyonu
const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 800;
const GRID_SIZE = 20;
const WALL_THICKNESS = 8;
const PIXELS_PER_CM = 2;


type SpecialMarkerType = 'entrance' | 'exit' | 'location';

export default function App() {
  const canvasRef = useRef<fabric.Canvas | null>(null);
  const [defaultMapCounter, setDefaultMapCounter] = useState<number>(1);
  // Son imleç konumunu tutmak (ürün ekleme için)
  const lastPointerRef = useRef<{ x: number; y: number }>({ x: 100, y: 100 });
  // Duvar çizimi için geçici referanslar
  const wallStartRef = useRef<{ x: number; y: number } | null>(null);
  const tempWallRectRef = useRef<fabric.Rect | null>(null);
  const tempDimensionTextRef = useRef<fabric.Text | null>(null);

  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [selectedObject, setSelectedObject] = useState<fabric.Object | null>(null);
  const [markers, setMarkers] = useState<Record<SpecialMarkerType, fabric.Object | null>>({
    entrance: null,
    exit: null,
    location: null
  });
  const [mapId, setMapId] = useState<string>('');

  // Yardımcı: Belirli bir noktanın, döndürülmüş (rotated) bir dikdörtgenin içinde olup olmadığını kontrol eder.
  const isPointInRotatedRect = (point: fabric.Point, rect: fabric.Object): boolean => {
    const center = new fabric.Point(rect.left!, rect.top!);
    const angle = fabric.util.degreesToRadians(rect.angle || 0);
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    // Noktayı -angle kadar döndür (rect'in koordinat sistemine getir)
    const rotatedX = dx * Math.cos(-angle) - dy * Math.sin(-angle);
    const rotatedY = dx * Math.sin(-angle) + dy * Math.cos(-angle);
    return Math.abs(rotatedX) <= (rect.width! / 2) && Math.abs(rotatedY) <= (rect.height! / 2);
  };

  useEffect(() => {
    const initCanvas = () => {
      const canvas = new fabric.Canvas('canvas', {
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
        backgroundColor: '#fafafa',
        selection: true,
      });
      canvasRef.current = canvas;

      // İmlecin son konumunu güncellemek için
      canvas.on('mouse:move', (e: fabric.IEvent) => {
        const pointer = canvas.getPointer(e.e);
        lastPointerRef.current = pointer;
      });

      canvas.on('object:moving', handleObjectMoving);
      canvas.on('object:modified', handleObjectModified);
      canvas.on('selection:created', handleSelection as any);
      canvas.on('selection:updated', handleSelection as any);
      canvas.on('selection:cleared', clearSelection);

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

  const handleSelection = (e: fabric.IEvent & { selected?: fabric.Object[] }) => {
    setSelectedObject(e.selected && e.selected.length > 0 ? e.selected[0] : null);
  };

  const clearSelection = () => {
    setSelectedObject(null);
  };

  // Ürün veya raft hareket ettiğinde çalışır.  
  // Eğer hareket eden obje bir raft ise, o raftın içindeki (attached) ürünlerin konumunu güncelliyoruz.
  const handleObjectMoving = (e: fabric.IEvent) => {
    const obj = e.target;
    if (!obj) return;

    // Grid hizalama
    obj.set({
      left: Math.round(obj.left! / GRID_SIZE) * GRID_SIZE,
      top: Math.round(obj.top! / GRID_SIZE) * GRID_SIZE
    });

    // Eğer hareket eden obje bir raft ise:
    if (obj.data?.isShelf) {
      const shelfCenter = new fabric.Point(obj.left!, obj.top!);
      const angleRad = fabric.util.degreesToRadians(obj.angle || 0);
      canvasRef.current?.getObjects().forEach(item => {
        if (item.data?.isProduct && item.data.parentShelf === obj) {
          const relativeX = item.data.relativeX;
          const relativeY = item.data.relativeY;
          const rotatedX = relativeX * Math.cos(angleRad) - relativeY * Math.sin(angleRad);
          const rotatedY = relativeX * Math.sin(angleRad) + relativeY * Math.cos(angleRad);
          item.set({
            left: shelfCenter.x + rotatedX,
            top: shelfCenter.y + rotatedY,
          });
          // Ürünün daima raftan üstte görünmesi için
          item.bringToFront();
        }
      });
    }
  };

  // Ürün bırakıldıktan (move tamamlandıktan) sonra, eğer ürün bir raftın içine bırakıldıysa ilişkilendir,
  // aksi halde ilişki kaldırılır.
  const handleObjectModified = (e: fabric.IEvent) => {
    const obj = e.target;
    if (!obj) return;

    if (obj.data?.isProduct) {
      const product = obj;
      const center = product.getCenterPoint();
      const canvas = canvasRef.current;
      if (!canvas) return;

      // Ürün halihazırda bir rafta kayıtlıysa:
      if (product.data.parentShelf) {
        const shelf = product.data.parentShelf as fabric.Object;
        // Eğer ürün artık raftın içinde değilse, ilişki kaldırılır.
        if (!isPointInRotatedRect(center, shelf)) {
          delete product.data.parentShelf;
          delete product.data.relativeX;
          delete product.data.relativeY;
          product.bringToFront();
        } else {
          // Ürün hâlâ rafta ise, relative offset güncellenir.
          const shelfCenter = new fabric.Point(shelf.left!, shelf.top!);
          product.data.relativeX = center.x - shelfCenter.x;
          product.data.relativeY = center.y - shelfCenter.y;
        }
      } else {
        // Ürün henüz bir rafta kayıtlı değilse, bırakıldığı noktaya göre bir raftın içine girip girmediği kontrol edilir.
        const shelves = canvas.getObjects().filter(o => o.data?.isShelf);
        for (const shelf of shelves) {
          if (isPointInRotatedRect(center, shelf)) {
            // Eğer rafta halihazırda 5 ürün varsa, ilişkilendirme yapılmaz.
            const attachedProducts = canvas.getObjects().filter(o => o.data?.isProduct && o.data.parentShelf === shelf);
            if (attachedProducts.length < 5) {
              product.data.parentShelf = shelf;
              const shelfCenter = new fabric.Point(shelf.left!, shelf.top!);
              product.data.relativeX = center.x - shelfCenter.x;
              product.data.relativeY = center.y - shelfCenter.y;
              product.bringToFront();
            }
            break;
          }
        }
      }
    }
  };

  // ─── DUVAR ÇİZİM EVENT HANDLER'LARI ─────────────────────────────

  const handleWallMouseDown = useCallback((e: fabric.IEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const pointer = canvas.getPointer(e.e);
    wallStartRef.current = pointer;
    const tempWall = new fabric.Rect({
      left: pointer.x,
      top: pointer.y,
      width: 0,
      height: WALL_THICKNESS,
      fill: '#757575',
      stroke: '#424242',
      strokeWidth: 1,
      originX: 'center',
      originY: 'center',
      selectable: false,
      evented: false,
    });
    tempWallRectRef.current = tempWall;
    canvas.add(tempWall);

    const tempText = new fabric.Text('0cm', {
      fontSize: 14,
      fill: '#424242',
      originX: 'center',
      originY: 'center',
      selectable: false,
      evented: false,
    });
    tempDimensionTextRef.current = tempText;
    canvas.add(tempText);
  }, []);

  const handleWallMouseMove = useCallback((e: fabric.IEvent) => {
    const canvas = canvasRef.current;
    if (!canvas || !wallStartRef.current || !tempWallRectRef.current || !tempDimensionTextRef.current)
      return;
    const pointer = canvas.getPointer(e.e);
    const start = wallStartRef.current;
    const dx = pointer.x - start.x;
    const dy = pointer.y - start.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
    const midX = (start.x + pointer.x) / 2;
    const midY = (start.y + pointer.y) / 2;
    tempWallRectRef.current.set({
      left: midX,
      top: midY,
      width: distance,
      angle: angle,
    });
    tempWallRectRef.current.setCoords();
    const lengthInCm = Math.round(distance / PIXELS_PER_CM);
    tempDimensionTextRef.current.set('text', `${lengthInCm}cm`);
    const angleRad = angle * (Math.PI / 180);
    const offset = 20;
    const textX = midX - offset * Math.sin(angleRad);
    const textY = midY + offset * Math.cos(angleRad);
    tempDimensionTextRef.current.set({ left: textX, top: textY, angle: angle });
    tempDimensionTextRef.current.setCoords();
    canvas.requestRenderAll();
  }, []);

  const handleWallMouseUp = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !wallStartRef.current || !tempWallRectRef.current || !tempDimensionTextRef.current)
      return;
    const wallRect = tempWallRectRef.current;
    const dimensionText = tempDimensionTextRef.current;
    const wallGroup = new fabric.Group([wallRect, dimensionText], {
      subTargetCheck: true,
      hasControls: true,
      data: { isWall: true }
    });
    canvas.remove(wallRect);
    canvas.remove(dimensionText);
    canvas.add(wallGroup);
    canvas.requestRenderAll();
    wallStartRef.current = null;
    tempWallRectRef.current = null;
    tempDimensionTextRef.current = null;
  }, []);

  const toggleDrawingMode = () => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    if (!isDrawingMode) {
      canvas.on('mouse:down', handleWallMouseDown);
      canvas.on('mouse:move', handleWallMouseMove);
      canvas.on('mouse:up', handleWallMouseUp);
    } else {
      canvas.off('mouse:down', handleWallMouseDown);
      canvas.off('mouse:move', handleWallMouseMove);
      canvas.off('mouse:up', handleWallMouseUp);
      if (tempWallRectRef.current) {
        canvas.remove(tempWallRectRef.current);
        tempWallRectRef.current = null;
      }
      if (tempDimensionTextRef.current) {
        canvas.remove(tempDimensionTextRef.current);
        tempDimensionTextRef.current = null;
      }
      wallStartRef.current = null;
    }
    setIsDrawingMode(!isDrawingMode);
  };

  // ─── ÖZEL MARKER VE DİĞER ÖGELER ─────────────────────────────

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
      hasControls: true,
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
        ], { ...baseProps, left: CANVAS_WIDTH / 2, top: CANVAS_HEIGHT / 2 });
      default:
        throw new Error('Invalid marker type');
    }
  };

  // ─── RAFT EKLEME (SHELF) ─────────────────────────────

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
      lockRotation: false, // Döndürülebilir
      originX: 'center',
      originY: 'center',
      data: { isShelf: true }
    });
    shelf.controls.mtr = new fabric.Control({
      x: 0.5,
      y: -0.5,
      actionHandler: (fabric as any).controlsUtils.rotationWithSnapping,
      cursorStyle: 'crosshair',
      actionName: 'rotate'
    });
    canvas.add(shelf);
    canvas.renderAll();
  };

  // ─── ÜRÜN EKLEME (PRODUCT) ─────────────────────────────
  // Ürün eklenirken, ekleme anındaki imleç pozisyonuna göre; eğer o pozisyon bir raftın içindeyse,
  // (max. 5 ürün kontrolü yapılarak) ürün otomatik olarak o rafta kayıtlı hale getiriliyor.
  const addProduct = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const product = new fabric.Textbox('Product', {
      width: 120,
      fontSize: 14,
      fill: '#2c3e50',
      textAlign: 'center',
      hasControls: true,
      lockRotation: false, // 360° döndürülebilir
      data: { isProduct: true }
    });
    const pointer = lastPointerRef.current;
    // Ürünü eklerken, eklenme noktasının bir raftın içinde olup olmadığını kontrol ediyoruz.
    const shelf = canvas.getObjects().find(obj => {
      if (!obj.data?.isShelf) return false;
      return isPointInRotatedRect(new fabric.Point(pointer.x, pointer.y), obj);
    });
    if (shelf) {
      const attachedProducts = canvas.getObjects().filter(o => o.data?.isProduct && o.data.parentShelf === shelf);
      if (attachedProducts.length < 5) {
        product.data.parentShelf = shelf;
        const shelfCenter = new fabric.Point(shelf.left!, shelf.top!);
        product.data.relativeX = pointer.x - shelfCenter.x;
        product.data.relativeY = pointer.y - shelfCenter.y;
        product.set({ left: pointer.x, top: pointer.y });
        canvas.add(product);
        product.bringToFront();
      } else {
        // Eğer rafta 5 ürün varsa, ürünü normal ekliyoruz.
        product.set({ left: pointer.x, top: pointer.y });
        canvas.add(product);
      }
    } else {
      product.set({ left: pointer.x, top: pointer.y });
      canvas.add(product);
    }
    canvas.renderAll();
  };

  const deleteSelectedObject = () => {
    if (!canvasRef.current || !selectedObject) return;
    canvasRef.current.remove(selectedObject);
    if (selectedObject.data?.markerType) {
      const type = selectedObject.data.markerType as SpecialMarkerType;
      setMarkers(prev => ({ ...prev, [type]: null }));
    }
    setSelectedObject(null);
    canvasRef.current.renderAll();
  };

  const saveMap = async () => {
    if (!canvasRef.current) return;
    try {
      
      // mapId state'si, ekrandaki dosya adı giriş alanından geliyor.
      // Eğer kullanıcı bir şey girmediyse defaultMapCounter değeri kullanılıyor.
      let fileName = mapId;
      if (!fileName || fileName.trim() === "") {
        fileName = defaultMapCounter.toString();
        setDefaultMapCounter(defaultMapCounter + 1);
      }
      const json = canvasRef.current.toJSON();
      // Dosya ismi ve harita verisini backend'e gönderiyoruz.
      const response = await fetch('http://localhost:8080/api/maps', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ filename: fileName, mapData: json })
      });
      const savedId = await response.text();
      setMapId(savedId);
      alert(`Map saved successfully! ID: ${savedId}`);
    } catch (error) {
      alert(`Failed to save map: ${error}`);
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
              inputMode="text"
              onChange={(e) => setMapId(e.target.value)}
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
            <Typography variant="subtitle1" sx={{ mt: 2 }}>Persistence</Typography>
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
