import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Signin } from "./pages/Signin";
import { Home } from "./Home";
import {PhaserGame} from "./PhaserGame";
import { Signup } from "./pages/Signup";
import { useRecoilValue } from "recoil";
import { validUser } from "./components/recoil";
import { Play } from "./pages/Play";
import { NewGame } from "./pages/NewGame";
import { Resume } from "./pages/Resume";
import {Leaderboard} from "./pages/Leaderboard";
import {CompLevel} from "./pages/CompLevel";
import { useEffect, useState } from "react";
import { SocketConnection } from "./components/socket";
import { Socket } from "socket.io-client";
import { LevelLeaderboard } from "./pages/LevelLeaderBoard";


function App() {

  const user=useRecoilValue(validUser);
  const [socket, setSocket] = useState< Socket |null >(null);
 
  console.log(user);
  
  useEffect(() => {
    if (user.isValid) {
      const newSocket = SocketConnection(user);

      setSocket(newSocket);

      return ()=>{

        if (socket) {
          socket.disconnect(); 
        }

      }
    }
  }, [user,user?.isValid]);

    return (
        
        <BrowserRouter>
            <Routes>
                
                <Route path="/" element={<Home/>}/>
                <Route path="/signin" element={<Signin/>}/>
                <Route path="/signup" element={<Signup/>}/>
                <Route path="/play"  element={ <Play/> }/>
                <Route path="/game" element={  <PhaserGame socket={socket} />}/>
                <Route path="/newgame" element={<NewGame/>}/>
                <Route path="/resume" element={<Resume/>}/>
                <Route path="/leaderboard" element={<Leaderboard/>}/>
                <Route path="/level-leaderboard/:levelName" element={<LevelLeaderboard/>}/>
                <Route path="/complevel" element={<CompLevel/>}/>



            </Routes>
        </BrowserRouter>
    );
}

export default App;
