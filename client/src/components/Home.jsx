import React from "react";
import './Home.css';
import { useNavigate } from 'react-router-dom';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Typography from '@mui/material/Typography';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';


const Home = () => {
    const navigate = useNavigate();

    const handleJoinGame = () => {
        navigate("/join");
    }

    const handleHostGame = () => {
        navigate("/host");
    }

    return (
        <div className="home-container">
            <h1>Welcome to the Race Game!</h1>
            <p>Get ready to place your bets and watch the race unfold!</p>
            <div className="inline-container">
                <div className="button-container">
                    <button onClick={handleJoinGame}> Join Game </button>
                    <button onClick={handleHostGame}> Host </button>
                </div>    
                <Accordion
                sx={{ width: '90%', borderRadius: '4px', marginTop: '20px', backgroundColor: '#f9f9f9' }}
                >
                    <AccordionSummary
                    expandIcon={<ExpandMoreIcon />}
                    aria-controls="panel1-content"
                    id="panel1-header"
                    >
                        <Typography component="span" >Rules of the game</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                    Lorem ipsum dolor sit amet, consectetur adipiscing elit. Suspendisse
                    malesuada lacus ex, sit amet blandit leo lobortis eget.
                    </AccordionDetails>
                </Accordion>
            </div>

        </div>
    );
}

export default Home;