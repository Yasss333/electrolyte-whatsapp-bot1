import { createContext, useContext, useState } from 'react';

const AppContext = createContext();

export const AppProvider = ({ children }) => {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [tasks, setTasks] = useState([]);
  const [technicians, setTechnicians] = useState([]);

  const triggerRefresh = () => setRefreshTrigger(prev => prev + 1);

  return (
    <AppContext.Provider
      value={{
        refreshTrigger,
        triggerRefresh,
        tasks,
        setTasks,
        technicians,
        setTechnicians,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => useContext(AppContext);