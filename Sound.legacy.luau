local HttpService = game:GetService("HttpService")

local port = "https://kscmt27w-3002.euw.devtunnels.ms/"

local GetAsync = HttpService.GetAsync
local JSONDecode = HttpService.JSONDecode

local fps = 400
local batchsize = 10

local soundids = {
	"birds"
}

local sounddata = {}

local toneSoundId = "rbxassetid://126161426843199"
local toneCount = 32
local detuneSpread = 0.06
local masterGain = 12
local tones = {}
local toneDetune = {}
local toneMix = {}
local toneFolder = Instance.new("Folder")
toneFolder.Name = "ToneVoices"
toneFolder.Parent = workspace

local maxFps = 400

for i = 1, toneCount do
	local center = (toneCount + 1) / 2
	local offset = (i - center) / center
	toneDetune[i] = 1 + (offset * detuneSpread)
	toneMix[i] = 1 / toneCount
end

for i = 1, toneCount do
	local tone = Instance.new("Sound")
	tone.SoundId = toneSoundId
	tone.Looped = true
	tone.Volume = 0
	tone.Parent = toneFolder
	tones[i] = tone
end

local function GetRequest(url,retries)
	retries = retries or 3
	for i=1,retries do
		print("Requesting:",url,"attempt",i)
		local success,response = pcall(GetAsync,HttpService,url)
		if success then
			local ok,decoded = pcall(JSONDecode,HttpService,response)
			if ok then
				print("Request success")
				return decoded
			end
		end
		print("Request failed, retrying...")
		task.wait(1)
	end
	print("Request failed completely")
end

local function getsoundsamount(sound)
	print("Getting total seconds for sound:",sound)
	local data = GetRequest(port.."?amount=4&sound="..sound)
	if data then
		if data["fps"] then
			fps = math.min(data["fps"], maxFps)
			batchsize = 10
		end
		print("Total seconds:",data["seconds"])
		return data["seconds"]
	end
end

local function startloader(sound)

	if sounddata[sound] then
		return
	end

	print("Starting loader for:",sound)

	sounddata[sound] = {
		sounds = {},
		soundsamount = nil,
		loaded = 0
	}

	task.spawn(function()

		local data = sounddata[sound]

		while not data.soundsamount do
			local amount = getsoundsamount(sound)
			if amount then
				data.soundsamount = amount
			else
				print("Waiting for sounds amount...")
				task.wait(2)
			end
		end

		while data.loaded < data.soundsamount do

			local index = data.loaded + 1
			local maxsound = math.min(index + batchsize - 1, data.soundsamount)

			print("Loading seconds",index,"to",maxsound)

			local request = GetRequest(port.."?minsound="..index.."&maxsound="..maxsound.."&sound="..sound)

			if request then
				if request["pitches"] and request["volumes"] then
					for i=1,#request["pitches"] do
						data.sounds[index + i - 1] = {
							pitches = request["pitches"][i],
							volumes = request["volumes"][i]
						}
					end
				else
					for i=1,#request do
						data.sounds[index + i - 1] = {
							pitches = request[i],
							volumes = nil
						}
					end
				end
				data.loaded = maxsound
				print("Loaded",data.loaded,"/",data.soundsamount,"seconds")
			else
				print("Batch failed, retrying...")
				task.wait(2)
			end

		end

		print("Finished loading sound:",sound)

	end)

end

for _,sound in ipairs(soundids) do
	startloader(sound)
end

local function playsound(sound)

	if not sounddata[sound] then
		startloader(sound)
	end

	local data = sounddata[sound]

	while not data.soundsamount do
		print("Waiting for metadata...")
		task.wait()
	end

	print("Waiting for buffer...")

	local minBuffer = math.min(3, data.soundsamount)
	while data.loaded < minBuffer do
		print("Loaded",data.loaded,"/",data.soundsamount,"seconds")
		task.wait(0.5)
	end

	print("Starting playback")

	local sounds = data.sounds
	local soundsamount = data.soundsamount

	local starttime = time()
	local lastindex = -1

	for i=1,#tones do
		tones[i]:Play()
	end

	while true do

		local elapsed = time() - starttime
		local frameindex = math.floor(elapsed * fps) + 1

		if frameindex > soundsamount * fps then
			break
		end

		if frameindex ~= lastindex then
			local secondIndex = math.floor((frameindex - 1) / fps) + 1
			local frameInSecond = ((frameindex - 1) % fps) + 1

			if secondIndex > data.loaded then
				starttime = starttime + 0.05
				task.wait(0.05)
				continue
			end

			local secondData = sounds[secondIndex]
			if secondData then
				local pitch = secondData.pitches and secondData.pitches[frameInSecond] or nil
				local volume = secondData.volumes and secondData.volumes[frameInSecond] or 1
				if pitch then
					for i=1,#tones do
						tones[i].PlaybackSpeed = pitch * toneDetune[i]
						tones[i].Volume = volume * toneMix[i] * masterGain
					end
				end
			end

			lastindex = frameindex
		end

		task.wait()

	end

	for i=1,#tones do
		tones[i]:Stop()
	end

	print("Playback finished")

end

game.ReplicatedStorage:WaitForChild("playsound").OnServerEvent:Connect(function(plr,sound)
	print("Play request from:",plr.Name,"for",sound)
	playsound(sound)
end)
