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