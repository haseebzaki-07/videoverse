import Link from "next/link";


export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 ml-64">
      <div className="relative flex flex-col items-center justify-center">
        <div className="absolute top-0 -z-10 h-full w-full">
          <div className="absolute inset-0 bg-gradient-to-r from-black/30 to-zinc-900/30 backdrop-blur-3xl" />
        </div>

        {/* Main Content */}
        <div className="text-center space-y-8 max-w-4xl">
          <div className="flex items-center justify-center space-x-2 mb-8">
            <div className="bg-white/10 backdrop-blur-md px-4 py-1 rounded-full">
              <p className="text-sm text-gray-200">✨ Smart AI</p>
            </div>
          </div>

          <h1 className="text-6xl font-bold text-white leading-tight">
            Transform Your Ideas into
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
              {" "}
              Stunning Videos
            </span>
          </h1>

          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Explore endless creative possibilities with our Next-Gen AI video
            generator. Create, edit, and enhance your videos with just a few
            clicks.
          </p>

          <div className="flex items-center justify-center space-x-4 mt-8">
            <Link
              href="/musicVideoGenerator"
              className="bg-gradient-to-r from-blue-500 to-purple-500 text-white px-8 py-3 rounded-full font-medium hover:opacity-90 transition-opacity"
            >
              Start Creating
            </Link>
            <Link
              href={`/generateWithAI`}
              className="bg-white/10 backdrop-blur-md text-white px-8 py-3 rounded-full font-medium hover:bg-white/20 transition-all"
            >
              Try AI Editor
            </Link>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16">
            {features.map((feature, index) => (
              <div
                key={index}
                className="bg-white/5 backdrop-blur-lg rounded-xl p-6 hover:bg-white/10 transition-all"
              >
                <div className="text-2xl mb-2">{feature.icon}</div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  {feature.title}
                </h3>
                <p className="text-gray-400 text-sm">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}

const features = [
  {
    icon: "🎨",
    title: "AI-Powered Generation",
    description:
      "Create professional videos from text descriptions using advanced AI technology",
  },
  {
    icon: "✨",
    title: "Smart Editing",
    description:
      "Edit your videos with intuitive controls and real-time preview",
  },
  {
    icon: "🎵",
    title: "Music Integration",
    description: "Automatically sync your video with music and add voice-overs",
  },
];
