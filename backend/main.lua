local logger = require("logger")
local millennium = require("millennium")
local fs = require("fs")

local function read_link(path)
    local handle = io.popen(string.format('readlink "%s"', path))
    local target = handle:read("*l")
    handle:close()
    return target
end

-- Copies the contents of an existing compatdata folder into the universal prefix (never overwrites).
-- Returns the number of copied items, or nil and an error if anything failed to copy.
local function merge_into_prefix(compatdata_path, proton_prefix_path)
    local copied = 0
    for _, item in ipairs(fs.list(compatdata_path) or {}) do
        local dest = fs.join(proton_prefix_path, item.name)
        if not fs.exists(dest) then
            local copy = item.is_directory and fs.copy_recursive or fs.copy
            local ok, err = copy(item.path, dest, false)
            if not ok then
                return nil, "Failed to copy " .. item.path .. ": " .. tostring(err)
            end
            copied = copied + 1
        end
    end
    return copied
end

-- Function callable from frontend to create symlinks
-- Frontend passes object with {app_id, compatdata_path, proton_prefix_path}
-- Lua receives them unpacked in alphabetical order: app_id, compatdata_path, proton_prefix_path
function create_symlinks(app_id, compatdata_path, proton_prefix_path)
    if not fs.is_directory(proton_prefix_path) then
        return "Proton prefix path is not a directory: " .. proton_prefix_path
    end

    local copied = 0
    if fs.is_symlink(compatdata_path) then
        if read_link(compatdata_path) == proton_prefix_path then
            return "App " .. app_id .. " already uses the universal prefix"
        end
        fs.remove(compatdata_path)
    elseif fs.is_directory(compatdata_path) then
        local err
        copied, err = merge_into_prefix(compatdata_path, proton_prefix_path)
        if not copied then
            logger:error(err)
            return err
        end
        fs.remove_all(compatdata_path)
    end

    local ok = os.execute(string.format('ln -s "%s" "%s"', proton_prefix_path, compatdata_path))
    if ok ~= 0 and ok ~= true then
        local err = "Failed to create symlink " .. compatdata_path .. " -> " .. proton_prefix_path
        logger:error(err)
        return err
    end

    local message = "Linked app " .. app_id .. " to universal prefix"
    if copied > 0 then
        message = message .. ", copied " .. copied .. " items from existing compatdata"
    end
    logger:info(message)
    return message
end

local function on_load()
    logger:info("Proton Universal Prefix backend loaded")
    millennium.ready()
end

local function on_unload()
    logger:info("Proton Universal Prefix backend unloaded")
end

local function on_frontend_loaded()
    logger:info("Frontend loaded")
end

return {
    on_load = on_load,
    on_unload = on_unload,
    on_frontend_loaded = on_frontend_loaded
}
