import React, { useState, useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import { dummyPublishedCreationData } from '../assets/assets';
import { Heart } from 'lucide-react';
import axios from 'axios'
import { useAuth } from '@clerk/clerk-react';
import  toast  from 'react-hot-toast';

axios.defaults.baseURL = import.meta.env.VITE_BASE_URL

const Community = () => {
  const [creations, setCreations] = useState([]);
  const { user } = useUser();
  const [loading, setLoading] = useState(true)
  const {getToken} = useAuth()

  const fetchCreations = async () => {
    try{
      const { data } = await axios.get('/api/user/get-published-creations', {
        headers : {Authorization: `Bearer ${await getToken()}`}
      })
      if(data.success){
        setCreations(data.creations)
      }else{
        toast.error(data.message)
      }
    }catch(error){
      toast.error(error.message)
    }
    setLoading(false)
  };

  const imageLikeToggle = async (id) =>{
    try{
      const { data } = await axios.post('/api/user/toggle-like-creation',{id}, {
      headers : {Authorization: `Bearer ${await getToken()}`}
      })
      if(data.success){
        toast.success(data.message)
        await fetchCreations()
      }else{
        toast.error(data.message)
      }
    }catch(error){
      toast.error(error.message)
    }
  }

  useEffect(() => {
    if (user) {
      fetchCreations();
    }
  }, [user]);

  return !loading ? (
    <div className="flex-1 h-full flex flex-col gap-4 p-6">
      <h1 className="text-xl font-semibold">Creations</h1>

      <div className="bg-white h-full w-full rounded-xl overflow-y-scroll p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {creations.map((creation, index) => (
            <div
              key={index}
              className="relative group rounded-lg overflow-hidden bg-gray-100"
            >
              {/* IMAGE */}
              <img
                src={creation.content}
                alt="creation"
                className="w-full h-auto object-contain"
              />

              {/* HOVER OVERLAY */}
              <div
                className="
                  absolute inset-0 
                  flex flex-col justify-end 
                  p-3 
                  bg-gradient-to-b from-transparent to-black/80 
                  opacity-0 group-hover:opacity-100 
                  transition-opacity duration-300
                "
              >
                <p className="text-sm text-white mb-2">
                  {creation.prompt}
                </p>

                <div className="flex items-center gap-1 text-white">
                  <p>{creation.likes.length}</p>
                  <Heart onClick = {()=>imageLikeToggle(creation.id)}
                    className={`w-5 h-5 cursor-pointer transition-transform hover:scale-110
                      ${
                        creation.likes.includes(user?.id)
                          ? 'fill-red-500 text-red-500'
                          : 'text-white'
                      }
                    `}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  ) : (
    <div className = 'flex justify-center items-center h-full'>
      <span className = 'w-10 h-10 my-1 rounded-full border-3 border-primary border-t-transparent animate-spin'></span>
    </div>
  )
};

export default Community;
