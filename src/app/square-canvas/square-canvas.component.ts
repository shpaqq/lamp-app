import { AfterViewInit, Component, ElementRef, ViewChild } from '@angular/core';
import { LightService } from './light-service';

// Define a type for square information
export interface SquareInfo {
	selected: boolean;
	lastToggled: number;
	xCanvas: number;
	yCanvas: number;
	sizeCanvas: number;
}

export interface LampLightInfo {
	lampWidthInM: number;
	lampHeightInM: number;
	lampLightHeightInM: number;
	lampLightWidthInM: number;
	lampPosition: 'horizontal' | 'vertical';
}

export interface Point {
	xCanvas: number;
	yCanvas: number;
}

export interface Lamp {
	lightLeftTopPoint: Point;
	frameLeftTopPoint: Point;
}


@Component({
	selector: 'app-square-canvas',
	template: `
		<button (click)="calculate()">Calculate</button>
		<div>
			Initial Area Width: <input (change)="updateInitialArea()" [(ngModel)]="initialWidth" type="number">
			Initial Area Height: <input (change)="updateInitialArea()" [(ngModel)]="initialHeight" type="number">
			Lamp Frame Width in M: <input [(ngModel)]="lampWidthInM" type="number">
			Lamp Frame Height in M: <input [(ngModel)]="lampHeightInM" type="number">
			Lamp Light Width in M: <input [(ngModel)]="lampLightWidthInM" type="number">
			Lamp Light Height in M: <input [(ngModel)]="lampLightHeightInM" type="number">
			Lamp Position:
			<select [(ngModel)]="lampPosition">
				<option value="horizontal">Horizontal</option>
				<option value="vertical">Vertical</option>
			</select>
			With moving lamp algorithm: <input type="checkbox" [(ngModel)]="withMovingLampAlgorithm">

		</div>

		<canvas #myCanvas
				(mousedown)="onMouseDown($event)"
				(mouseleave)="onMouseUp($event)"
				(mousemove)="onMouseMove($event)"
				(mouseup)="onMouseUp($event)"
				height="1000"
				width="1000"></canvas>
	`
})
export class SquareCanvasComponent implements AfterViewInit {
	@ViewChild('myCanvas') myCanvas: ElementRef<HTMLCanvasElement>;

	squareSize: number = 20; // Changed square size to 20 pixels

	grid: SquareInfo[][] = Array(50).fill(null).map((_, xIndex) => Array(50).fill(null).map((_, yIndex) => ({
		selected: false,
		lastToggled: 0,
		xCanvas: xIndex * this.squareSize, // Obliczanie pozycji x na canvasie
		yCanvas: yIndex * this.squareSize, // Obliczanie pozycji y na canvasie
		sizeCanvas: this.squareSize // Rozmiar kwadratu na canvasie
	})));


	isMouseDown: boolean = false; // Track if the mouse button is held down

	debouncePeriod: number = 500; // Adjust as needed

	lightValue: number = 1.4; // Domyślna wartość pokrycia


	initialWidth: number = 10; // Default initial width

	initialHeight: number = 10; // Default initial height

	lampWidthInM: number = 0.1; // Default lamp width

	lampHeightInM: number = 1; // Default lamp height

	lampLightWidthInM: number = 1.0; // Default lamp light width

	lampLightHeightInM: number = 1.5; // Default lamp light height

	lampPosition: 'horizontal' | 'vertical' = 'vertical'; // Default lamp position

	withMovingLampAlgorithm: boolean = false;

	private readonly lightService = new LightService();


	ngAfterViewInit(): void {
		this.drawGrid();
	}

	updateInitialArea(): void {
		this.colorInitialArea();
		this.drawGrid();
	}

	calculate(): void {
		const lampInfo = {
			lampWidthInM: this.lampWidthInM,
			lampHeightInM: this.lampHeightInM,
			lampLightHeightInM: this.lampLightHeightInM,
			lampLightWidthInM: this.lampLightWidthInM,
			lampPosition: this.lampPosition
		};
		this.drawGrid();
		// const lampPoints = this.calculateLampPosition(this.grid, lampInfo);
		// console.log(lampPoints);
		// this.drawLamps(lampPoints, lampInfo);
		this.lightService.drawLight(this.grid, lampInfo, this.myCanvas.nativeElement.getContext('2d'));

	}


	// calculateLampPosition(grid: SquareInfo[][], lampLightInfo: LampLightInfo): LampPoint[] {
	// 	// 1. sprawdz ktore kwadraty w siatce sa zaznaczone, kazdy kwadrat odpowiada 1m2
	// 	// 2. dla kazdego kwadratu sprawdz czy caly obszar jest w zasiegu lampy. z dokladnoscia do 1px. kazdy kwadrat to 20px x 20px
	// // 3. sprawdz to za pomoca iterowania po kazdym pixelu w kwadracie i patrzeniu czy jest zaznaczony
	// 	// 4. jesli nie jest to dodaj lampe w lewym gornym rogu kwadratu

	// }

	calculateLampPosition(grid: SquareInfo[][], lampLightInfo: LampLightInfo): Point[] {
		const lightPoints: Point[] = [];
		const lampPoints: Point[] = [];

		grid.forEach((row, x) => {
			row.forEach((cell, y) => {
				if (cell.selected) {
					if (!this.isSquarePartialLighted(cell, lightPoints, lampLightInfo)) {
						const lightPoint = { xCanvas: cell.xCanvas, yCanvas: cell.yCanvas };
						lightPoints.push(lightPoint);
						lampPoints.push(this.calculateLampPoint(lightPoint));
					} else {
						if (this.isSquareFullyLighted(cell, lightPoints, lampLightInfo)) {
						} else {
							const firstFreeX = this.findFirstFreeX(cell, lightPoints, lampLightInfo) - 1;
							const firstFreeY = this.findFirstFreeY(cell, lightPoints, lampLightInfo) - 1;
							if (firstFreeX !== -1 && firstFreeY !== -1) {
								const lightPoint = { xCanvas: firstFreeX, yCanvas: firstFreeY };
								lightPoints.push(lightPoint);
								lampPoints.push(this.calculateLampPoint(lightPoint));
							}
						}
					}
				}
			});
		});

		if (this.withMovingLampAlgorithm) {
			lampPoints.forEach((lampPoint, index) => {
				if (this.isLampFullyInSquares(lampPoint, lampLightInfo, grid)) {
					console.log('lampPoint - fit', lampPoint);
				} else {
					console.log('lampPoint - does not fit', lampPoint);
					const lightPointOffset = this.calculateLightPointOffsetInPx(lampPoint, lampLightInfo, grid);
					const lightPointToMove = lightPoints[index];
					if (lightPointOffset > 0) {
						if (lampLightInfo.lampPosition === 'horizontal') {
							lightPointToMove.xCanvas -= lightPointOffset;
						} else {
							lightPointToMove.yCanvas -= lightPointOffset;
						}
					}
					console.log('lightPointOffset', lightPointOffset);

				}
			});
		}


		return lightPoints;
	}


	calculateLightPointOffsetInPx(lampPoint: Point, lampInfo: LampLightInfo, grid: SquareInfo[][]): number {
		const selectedSquares = grid.reduce((acc, row) => {
			return acc.concat(row.filter(cell => cell.selected));
		}, []);

		let offset = 0;
		const squareThatLapsInAndIsBigger = selectedSquares.find(cell => {
			if (lampInfo.lampPosition === 'horizontal') {
				const leftTopCorner = { xCanvas: lampPoint.xCanvas, yCanvas: lampPoint.yCanvas };
				const rightTopCorner = { xCanvas: lampPoint.xCanvas + lampInfo.lampWidthInM * 20, yCanvas: lampPoint.yCanvas };
				const leftBottomCorner = { xCanvas: lampPoint.xCanvas, yCanvas: lampPoint.yCanvas + lampInfo.lampHeightInM * 20 };
				const rightBottomCorner = { xCanvas: lampPoint.xCanvas + lampInfo.lampWidthInM * 20, yCanvas: lampPoint.yCanvas + lampInfo.lampHeightInM * 20 };

				return (leftTopCorner.xCanvas >= cell.xCanvas && leftTopCorner.xCanvas <= cell.xCanvas + cell.sizeCanvas &&
					leftTopCorner.yCanvas >= cell.yCanvas && leftTopCorner.yCanvas <= cell.yCanvas + cell.sizeCanvas) ||
					(rightTopCorner.xCanvas >= cell.xCanvas && rightTopCorner.xCanvas <= cell.xCanvas + cell.sizeCanvas &&
						rightTopCorner.yCanvas >= cell.yCanvas && rightTopCorner.yCanvas <= cell.yCanvas + cell.sizeCanvas) ||
					(leftBottomCorner.xCanvas >= cell.xCanvas && leftBottomCorner.xCanvas <= cell.xCanvas + cell.sizeCanvas &&
						leftBottomCorner.yCanvas >= cell.yCanvas && leftBottomCorner.yCanvas <= cell.yCanvas + cell.sizeCanvas) ||
					(rightBottomCorner.xCanvas >= cell.xCanvas && rightBottomCorner.xCanvas <= cell.xCanvas + cell.sizeCanvas &&
						rightBottomCorner.yCanvas >= cell.yCanvas && rightBottomCorner.yCanvas <= cell.yCanvas + cell.sizeCanvas);
			} else {
				const leftTopCorner = { xCanvas: lampPoint.xCanvas, yCanvas: lampPoint.yCanvas };
				const rightTopCorner = { xCanvas: lampPoint.xCanvas + lampInfo.lampHeightInM * 20, yCanvas: lampPoint.yCanvas };
				const leftBottomCorner = { xCanvas: lampPoint.xCanvas, yCanvas: lampPoint.yCanvas + lampInfo.lampWidthInM * 20 };
				const rightBottomCorner = { xCanvas: lampPoint.xCanvas + lampInfo.lampHeightInM * 20, yCanvas: lampPoint.yCanvas + lampInfo.lampWidthInM * 20 };

				return (leftTopCorner.xCanvas >= cell.xCanvas && leftTopCorner.xCanvas <= cell.xCanvas + cell.sizeCanvas &&
					leftTopCorner.yCanvas >= cell.yCanvas && leftTopCorner.yCanvas <= cell.yCanvas + cell.sizeCanvas) ||
					(rightTopCorner.xCanvas >= cell.xCanvas && rightTopCorner.xCanvas <= cell.xCanvas + cell.sizeCanvas &&
						rightTopCorner.yCanvas >= cell.yCanvas && rightTopCorner.yCanvas <= cell.yCanvas + cell.sizeCanvas) ||
					(leftBottomCorner.xCanvas >= cell.xCanvas && leftBottomCorner.xCanvas <= cell.xCanvas + cell.sizeCanvas &&
						leftBottomCorner.yCanvas >= cell.yCanvas && leftBottomCorner.yCanvas <= cell.yCanvas + cell.sizeCanvas) ||
					(rightBottomCorner.xCanvas >= cell.xCanvas && rightBottomCorner.xCanvas <= cell.xCanvas + cell.sizeCanvas &&
						rightBottomCorner.yCanvas >= cell.yCanvas && rightBottomCorner.yCanvas <= cell.yCanvas + cell.sizeCanvas);
			}
		});
		if (squareThatLapsInAndIsBigger) {
			console.log('squareThatLapsInAndIsBigger', squareThatLapsInAndIsBigger);
			if (lampInfo.lampPosition === 'horizontal') {
				offset = (lampPoint.xCanvas + lampInfo.lampHeightInM * 20) - (squareThatLapsInAndIsBigger.xCanvas + squareThatLapsInAndIsBigger.sizeCanvas)
			} else {
				offset = (lampPoint.yCanvas + lampInfo.lampHeightInM * 20) - (squareThatLapsInAndIsBigger.yCanvas + squareThatLapsInAndIsBigger.sizeCanvas)
			}
		}
		return offset;

	}

	isLampFullyInSquares(lampPoint: Point, lampInfo: LampLightInfo, grid: SquareInfo[][]): boolean {
		const meterToPixels = 20; // 1 meter = 20 pixels
		const lampLightWidthPx = lampInfo.lampPosition === 'vertical'
			? lampInfo.lampWidthInM * meterToPixels
			: lampInfo.lampHeightInM * meterToPixels;
		const lampLightHeightPx = lampInfo.lampPosition === 'vertical' ?
			lampInfo.lampHeightInM * meterToPixels
			: lampInfo.lampWidthInM * meterToPixels;


		for (let x = lampPoint.xCanvas; x < lampPoint.xCanvas + lampLightWidthPx; x++) {
			for (let y = lampPoint.yCanvas; y < lampPoint.yCanvas + lampLightHeightPx; y++) {
				if (!this.isPointInSquare(x, y, grid, lampInfo)) {
					return false;
				}
			}
		}
		return true;
	}

	isPointInSquare(x: number, y: number, grid: SquareInfo[][], lampInfo: LampLightInfo): boolean {

		const selectedSquares = grid.reduce((acc, row) => {
			return acc.concat(row.filter(cell => cell.selected));
		}, []);

		for (const cell of selectedSquares) {
			if (lampInfo.lampPosition === 'horizontal') {
				if (x >= cell.xCanvas && x <= cell.xCanvas + cell.sizeCanvas &&
					y >= cell.yCanvas && y <= cell.yCanvas + cell.sizeCanvas) {
					return true;
				}
			} else {
				if (x >= cell.xCanvas && x <= cell.xCanvas + cell.sizeCanvas &&
					y >= cell.yCanvas && y <= cell.yCanvas + cell.sizeCanvas) {
					return true;
				}
			}
		}
		return false;
	}

	calculateLampPoint(lightPoint: Point): Point {
		const meterToPixels = 20; // 1 meter = 20 pixels
		const lampLightWidthPx = this.lampLightWidthInM * meterToPixels;
		const lampLightHeightPx = this.lampLightHeightInM * meterToPixels;
		return {
			xCanvas: lightPoint.xCanvas + (lampLightWidthPx - this.lampWidthInM * meterToPixels) / 2,
			yCanvas: lightPoint.yCanvas + (lampLightHeightPx - this.lampHeightInM * meterToPixels) / 2
		};

	}

	findFirstFreeY(cell: SquareInfo, lightPoints: Point[], lampInfo: LampLightInfo): number {
		for (let y = cell.yCanvas; y < cell.yCanvas + cell.sizeCanvas; y++) {
			for (let x = cell.xCanvas; x < cell.xCanvas + cell.sizeCanvas; x++) {
				if (!this.isPointInLamp(x, y, lightPoints, lampInfo)) {
					return y;
				}
			}
		}
		return -1;
	}

	findFirstFreeX(cell: SquareInfo, lightPoints: Point[], lampInfo: LampLightInfo): number {
		for (let x = cell.xCanvas; x < cell.xCanvas + cell.sizeCanvas; x++) {
			for (let y = cell.yCanvas; y < cell.yCanvas + cell.sizeCanvas; y++) {
				if (!this.isPointInLamp(x, y, lightPoints, lampInfo)) {
					return x;
				}
			}
		}
		return -1;
	}


	isSquareFullyLighted(cell: SquareInfo, lightPoints: Point[], lampInfo: LampLightInfo): boolean {
		if (lightPoints.length === 0) {
			return false;
		}
		for (let x = cell.xCanvas; x < cell.xCanvas + cell.sizeCanvas; x++) {
			for (let y = cell.yCanvas; y < cell.yCanvas + cell.sizeCanvas; y++) {
				if (!this.isPointInLamp(x, y, lightPoints, lampInfo)) {
					return false;
				}
			}
		}
		return true;
	}

	isSquarePartialLighted(cell: SquareInfo, lightPoints: Point[], lampInfo: LampLightInfo): boolean {
		if (lightPoints.length === 0) {
			return false;
		}
		for (let x = cell.xCanvas; x < cell.xCanvas + cell.sizeCanvas; x++) {
			for (let y = cell.yCanvas; y < cell.yCanvas + cell.sizeCanvas; y++) {
				if (this.isPointInLamp(x, y, lightPoints, lampInfo)) {
					return true;
				}
			}
		}
		return false;

	}

	private isPointInLamp(x: number, y: number, lightPoints: Point[], lampInfo: LampLightInfo): boolean {
		const meterToPixels = 20; // 1 meter = 20 pixels
		const lampLightWidthPx = lampInfo.lampLightWidthInM * meterToPixels;
		const lampLightHeightPx = lampInfo.lampLightHeightInM * meterToPixels;

		for (const lampPoint of lightPoints) {
			if (lampInfo.lampPosition === 'horizontal') {
				if (x >= lampPoint.xCanvas && x <= lampPoint.xCanvas + lampLightHeightPx &&
					y >= lampPoint.yCanvas && y <= lampPoint.yCanvas + lampLightWidthPx) {
					return true;
				}
			} else {
				if (x >= lampPoint.xCanvas && x <= lampPoint.xCanvas + lampLightWidthPx &&
					y >= lampPoint.yCanvas && y <= lampPoint.yCanvas + lampLightHeightPx) {
					return true;
				}
			}
		}
		return false;
	}


	drawLamps(lampPoints: Point[], lampInfo: LampLightInfo): void {
		// Pobieranie kontekstu 2D z elementu canvas
		const ctx = this.myCanvas.nativeElement.getContext('2d');
		if (!ctx) {
			return;
		}

		// Ustawienia dla rysowania obszaru świetlnego
		const lightAreaColor = 'rgba(255, 255, 0, 0.5)'; // Kolor obszaru świetlnego z przezroczystością
		ctx.strokeStyle = 'orange'; // Kolor obramowania obszaru świetlnego
		ctx.lineWidth = 1; // Grubość linii obramowania

		// Przeliczanie wymiarów lampy z metrów na piksele
		const lampWidthPx = lampInfo.lampWidthInM * this.squareSize;
		const lampHeightPx = lampInfo.lampHeightInM * this.squareSize;

		lampPoints.forEach(lampPoint => {
			// Rysowanie obszaru świetlnego w zależności od orientacji lampy
			ctx.fillStyle = lightAreaColor;
			let lightWidthPx, lightHeightPx;
			if (lampInfo.lampPosition === 'horizontal') {
				lightWidthPx = lampInfo.lampLightHeightInM * this.squareSize;
				lightHeightPx = lampInfo.lampLightWidthInM * this.squareSize;
			} else {
				lightWidthPx = lampInfo.lampLightWidthInM * this.squareSize;
				lightHeightPx = lampInfo.lampLightHeightInM * this.squareSize;
			}
			ctx.beginPath();
			ctx.rect(lampPoint.xCanvas, lampPoint.yCanvas, lightWidthPx, lightHeightPx);
			ctx.fill();
			ctx.stroke();

			// Rysowanie czarnego paska reprezentującego lampę
			ctx.fillStyle = 'black';
			let barX, barY, barWidth, barHeight;
			if (lampInfo.lampPosition === 'horizontal') {
				// Poziomy pasek
				barWidth = lampInfo.lampHeightInM * this.squareSize;
				barHeight = lampInfo.lampWidthInM * this.squareSize;
				barX = lampPoint.xCanvas + (lightWidthPx - barWidth) / 2;
				barY = lampPoint.yCanvas + (lightHeightPx - barHeight) / 2;
			} else { // 'vertical'
				// Pionowy pasek
				barWidth = lampInfo.lampWidthInM * this.squareSize;
				barHeight = lampInfo.lampHeightInM * this.squareSize;
				barX = lampPoint.xCanvas + (lightWidthPx - barWidth) / 2;
				barY = lampPoint.yCanvas + (lightHeightPx - barHeight) / 2;
			}
			ctx.beginPath();
			ctx.rect(barX, barY, barWidth, barHeight);
			ctx.fill();
		});
	}


	colorInitialArea(): void {
		const gridWidth = this.grid.length;
		const gridHeight = this.grid[0].length;
		const startX = Math.floor((gridWidth - this.initialWidth) / 2);
		const startY = Math.floor((gridHeight - this.initialHeight) / 2);

		// Reset grid selection before applying new initial area
		this.grid.forEach(row => row.forEach(cell => cell.selected = false));

		for (let x = startX; x < startX + this.initialWidth; x++) {
			for (let y = startY; y < startY + this.initialHeight; y++) {
				if (x >= 0 && x < gridWidth && y >= 0 && y < gridHeight) {
					this.grid[x][y].selected = true;
				}
			}
		}
	}

	drawGrid(): void {
		const ctx = this.myCanvas.nativeElement.getContext('2d');
		if (!ctx) return;

		ctx.clearRect(0, 0, 1000, 1000); // Czyszczenie canvasa

		for (let x = 0; x < this.grid.length; x++) {
			for (let y = 0; y < this.grid[0].length; y++) {
				const square = this.grid[x][y];
				const { xCanvas, yCanvas, sizeCanvas } = square; // Destructuring dla czytelności

				ctx.strokeStyle = 'black';
				ctx.strokeRect(xCanvas, yCanvas, sizeCanvas, sizeCanvas);

				if (square.selected) {
					const padding = 2;
					const paddedSize = sizeCanvas - padding * 2;
					ctx.fillStyle = 'lightgrey';
					ctx.fillRect(xCanvas + padding, yCanvas + padding, paddedSize, paddedSize);
				}
			}
		}
	}


	onMouseDown(event: MouseEvent): void {
		this.isMouseDown = true;
		this.processMouseEvent(event);
	}

	onMouseMove(event: MouseEvent): void {
		if (this.isMouseDown) {
			this.processMouseEvent(event);
		}
	}

	onMouseUp(event: MouseEvent): void {
		this.isMouseDown = false;
	}

	processMouseEvent(event: MouseEvent): void {
		const rect = this.myCanvas.nativeElement.getBoundingClientRect();
		const x = event.clientX - rect.left;
		const y = event.clientY - rect.top;

		const clickedX = Math.floor(x / this.squareSize);
		const clickedY = Math.floor(y / this.squareSize);

		const now = Date.now();

		if (
			clickedX >= 0 && clickedX < this.grid.length &&
			clickedY >= 0 && clickedY < this.grid[0].length
		) {
			const square = this.grid[clickedX][clickedY];

			// Check if enough time has passed since the last toggle
			if (now - square.lastToggled > this.debouncePeriod) {
				square.selected = !square.selected;
				square.lastToggled = now; // Update the last toggled timestamp

				// Redraw the grid to reflect the updated state
				this.drawGrid();
			}
		}
	}
}
