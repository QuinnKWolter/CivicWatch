import '../index.css';

export const Tooltip = ({ xPos, yPos, name }) => {
    if (!xPos || !yPos || !name) {
        return null;
    }

    return (
        <div
            className='tooltip'
            style={{
                position: 'absolute',
                left: xPos,
                top: yPos,
                pointerEvents: 'none',
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                borderRadius: '4px',
                color: 'white',
                fontSize: '12px',
                padding: '5px',
            }}
        >
            {name}
        </div>
    );
};



export const TooltipGroup = ({ xPos, yPos, names }) => {
    if (!xPos || !yPos || !names || names.length === 0) {
        return null;
    }

    return (
        <div
            className='tooltip'
            style={{
                position: 'absolute',
                left: xPos,
                top: yPos,
                pointerEvents: 'none',
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                borderRadius: '4px',
                color: 'white',
                fontSize: '12px',
                padding: '5px',
                maxHeight: '150px', // adjust as needed
                overflowY: 'auto',
                width: '200px', // optional: helps define scroll area
            }}
        >
            <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                {names.map((name, index) => (
                    <li key={index} style={{ marginBottom: '4px' }}>
                        {name}
                    </li>
                ))}
            </ul>
        </div>
    );
};

