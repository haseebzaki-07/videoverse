
import PlaySound from '@/components/PlaySound';
import VideoGenerator from '@/components/VideoGenerator';
import Head from 'next/head';


export default function Home() {
  return (
    <div className='flex flex-col items-center justify-center min-h-screen py-2'>
       <PlaySound />
      <Head>
        <title>Text to Music Video Generator</title>
      </Head>
      <main>
        <h1>Text to Music Video Generator</h1>
       
       
        < VideoGenerator/>
      </main>
    </div>
  );
}
