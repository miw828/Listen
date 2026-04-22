// should have a settings button where the database is show
// have a set up button for share my music feature 

import "../styles/Home.css";

export default function Home({settings}){
    return(
        <div className = "homepage">
        <div className="dashboard">
        <header>Welcome to Listen!</header>
        <p>Where to first?</p>
        </div>

        <div className="options">
            <button> Profile 
                
                onClick={()=> takeProfile(d)}

            </button>

        </div>
        </div>
    )
}
