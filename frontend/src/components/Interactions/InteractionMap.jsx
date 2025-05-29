import * as d3 from 'd3'
import {useEffect, useRef, useLayoutEffect, useMemo} from 'react'
// const connections = [
//     ["Texas", "New York"],
//     ["Wisconsin", "California"]
// ]


export const InteractionMap = ({ width, height, data, connections }) => {
    const canvasRef = useRef(null);
      const requestRef = useRef()
        const progressRef = useRef(0)

    const projection = useMemo(() => 
  d3.geoAlbersUsa().fitSize([width, height], data)
, [width, height, data]);

    useLayoutEffect(() => {
        const canvas = canvasRef.current;
      
        console.log("canvas", canvas)
        const context = canvas?.getContext('2d');

        if (!context) {
            return
        }
        const pathGenerator = d3
            .geoPath()
            .projection(projection)
            .context(context)
        
        const stateCentroids = []
        
        data.features.forEach(feature => {
            const centroid = pathGenerator.centroid(feature);

            stateCentroids[feature.properties.name] = centroid;
        });

        let animationFrameId
        let progress = 0
        const animationSpeed = 0.05

         function getQuadraticPoint(t, p0, p1, p2) {
      const x = (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t ** 2 * p2[0]
      const y = (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t ** 2 * p2[1]
      return [x, y]
    }




        
        // context.clearRect(0, 0, width, height)
        // context.beginPath()

        // pathGenerator(data);

        // context.fillStyle = 'grey';
        // context.fill();

        // context.strokeStyle = 'lightGrey';
        // context.lineWidth = 0.1;
        // context.stroke();

        // context.strokeStyle = 'green';
        // context.lineWidth = 2;

        // connections.forEach(([stateA, stateB]) => {
        //     const start = stateCentroids[stateA];
        //     const end = stateCentroids[stateB];
        //     if (start && end) {
        //         context.beginPath()
        //         context.moveTo(start[0], start[1])
        //         const midX = (start[0] + end[0]) / 2;
        //         const midY = (start[1] + end[1]) / 2 - 15;

        //         context.quadraticCurveTo(midX, midY, end[0], end[1])

        //         context.stroke()
        //     }
        // })

        function drawFrame() {
      context.clearRect(0, 0, width, height)

      // Draw map base
      context.beginPath()
      pathGenerator(data)
      context.fillStyle = 'grey'
      context.fill()
      context.strokeStyle = 'lightGrey'
      context.lineWidth = 0.1
      context.stroke()

      // Draw animated connections
      context.strokeStyle = 'rgba(255, 240, 0, 0.5)'
            context.lineWidth = 4
            context.lineCap = 'round'
            context.lineJoin = 'round'

           

      connections.forEach(([stateA, stateB]) => {
        const start = stateCentroids[stateA]
        const end = stateCentroids[stateB]
        if (start && end) {
          const midX = (start[0] + end[0]) / 2
          const midY = (start[1] + end[1]) / 2 - 15
          const control = [midX, midY]

          context.beginPath()
          context.moveTo(start[0], start[1])

          // Approximate the curve by drawing small line segments from t=0 to t=progress
          const segments = 30
          for (let i = 1; i <= segments * progress; i++) {
            const t = i / segments
            const [x, y] = getQuadraticPoint(t, start, control, end)
            context.lineTo(x, y)
          }

          context.stroke()
        }
      })

      progress += animationSpeed
      if (progress > 1) progress = 1 // stop at full curve

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(drawFrame)
      }
        }
        
        drawFrame()

        return ()=> cancelAnimationFrame(animationFrameId)


    }, [width, height, projection, data, connections])

    return <canvas ref={canvasRef} width={width} height={height} />
    
    
}