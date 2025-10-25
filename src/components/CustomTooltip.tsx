import React from 'react';

interface CustomTooltipProps {
    content: React.ReactNode;
    position: { x: number; y: number };
    visible: boolean;
}

export const CustomTooltip: React.FC<CustomTooltipProps> = ({ content, position, visible }) => {
    if (!visible) return null;

    // Adjust position to prevent tooltip from going off-screen
    const winWidth = window.innerWidth;
    const winHeight = window.innerHeight;
    
    // Simple adjustment: if tooltip is too close to the right edge, flip it to the left of the cursor
    const finalX = (position.x + 150 > winWidth) ? position.x - 160 : position.x + 15;
    const finalY = (position.y + 100 > winHeight) ? position.y - 110 : position.y + 15;

    const style: React.CSSProperties = {
        top: finalY,
        left: finalX,
    };

    return (
        <div style={style} className="custom-tooltip">
            {content}
        </div>
    );
};