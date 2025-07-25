import React, {useEffect} from "react";
import { useSocket } from "../SocketContext";
import './Home.css';
import { useNavigate } from 'react-router-dom';
import Typography from '@mui/material/Typography';
import Modal from '@mui/material/Modal';
import Box from '@mui/material/Box';


const style = {
    width: { xs: "90vw", sm: 400 },
    maxHeight: "90vh",
    bgcolor: "background.paper",
    borderRadius: 4,
    boxShadow: 24,
    p: { xs: 2, sm: 4 },
    overflowY: "auto",
};



const Home = () => {
    const socket = useSocket();
    const [open, setOpen] = React.useState(false);
    const handleOpen = () => setOpen(true);
    const handleClose = () => setOpen(false);

    const navigate = useNavigate();

    const handleJoinGame = () => {
        navigate("/join");
    }

    const handleHostGame = () => {
        navigate("/host");
    }

    useEffect(() => {
    const roomId = sessionStorage.getItem("currentRoomId");
    if (roomId && socket) {
      socket.emit("deleteRoom", roomId);
      sessionStorage.removeItem("currentRoomId");
    }
  }, [socket]);

    return (
        <div className="home-container">
            <h1>Welcome to the Race Game!</h1>
            <p>Get ready to place your bets and watch the race unfold!</p>
            <div className="inline-container">
                <div className="button-container">
                    <button onClick={handleJoinGame}> Join Game </button>
                    <button onClick={handleHostGame}> Host </button>
                </div>

                <button onClick={handleOpen} className="rules-button">Game rules</button>
                <Modal 
                    open={open} 
                    onClose={handleClose}
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        p: 2,              
                    }}
                >
                    <Box sx={style}>
                        <Typography variant="h6" component="h2">
                            Rules of the game
                        </Typography>
                            <h3>Placing Bets</h3>
                        <Typography component="span">
                            1. Each player chooses a horse (ace suit card) to bet on.
                        </Typography>
                        <br />
                        <Typography component="span">
                            2. Players must then say how much they want to bet. <span style={{ fontStyle: 'italic', color: 'gray' }} >For example, 4 sips on the Ace of Spades.</span>
                        </Typography>
                        <br />
                        <Typography component="span">
                            3. They must then drink their bet amount upfront. <span style={{ fontStyle: 'italic', color: 'gray' }} >For example, if they bet 4 sips, they must drink 4 sips of their drink before the race starts.</span>
                        </Typography>
                        <br />
                        
                        
                        <h3>Race Details</h3>
                        <Typography component="span">
                            1. Cards from the race deck will be drawn, the horse with the same suit advances a position.
                        </Typography>
                        <br />
                        <Typography component="span">
                            2. When all horses have passed a row, a cramp card will be revealed and the suit will determine the horse that returns a position.
                        </Typography>
                        <br />
                        <Typography component="span">
                            3. The first horse to reach the finish line wins the race.
                        </Typography>
                        <br />
                        <h3>Winning and Drinking</h3>   
                        <Typography component="span">
                            The players whose horse wins the race distribute sips equal to their bet among the other players.
                        </Typography>
                        <br />
                    </Box>
                </Modal>
            </div>

        </div>
    );
}

export default Home;